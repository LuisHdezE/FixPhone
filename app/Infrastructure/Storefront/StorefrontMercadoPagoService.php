<?php

namespace App\Infrastructure\Storefront;

use App\Infrastructure\Inventory\InventoryItem;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

final class StorefrontMercadoPagoService
{
    public function __construct(
        private readonly MercadoPagoGateway $gateway,
        private readonly StorefrontOrderService $orders,
    ) {}

    public function isReady(): bool
    {
        return (bool) config('mercadopago.enabled') && $this->configurationValid();
    }

    public function configurationValid(): bool
    {
        return (string) config('mercadopago.access_token') !== ''
            && (string) config('mercadopago.webhook_secret') !== ''
            && (string) config('mercadopago.collector_id') !== ''
            && (string) config('mercadopago.application_id') !== ''
            && $this->isPublicHttpsUrl((string) config('mercadopago.public_url'))
            && (string) config('mercadopago.site_id') === 'MLU'
            && (string) config('mercadopago.currency') === 'UYU';
    }

    public function ensurePreference(object $order): object
    {
        $claim = DB::transaction(function () use ($order): array {
            $locked = DB::table('storefront_orders')->where('id', $order->id)->lockForUpdate()->first();
            if (! $locked) {
                abort(404);
            }
            if (in_array($locked->status, ['paid', 'payment_review', 'expired', 'cancelled'], true)
                || CarbonImmutable::parse($locked->reservation_expires_at)->isPast()) {
                throw ValidationException::withMessages(['checkout' => 'Esta orden ya no puede iniciar un pago.']);
            }
            if ($locked->mercadopago_preference_id && $locked->mercadopago_checkout_url) {
                return ['order' => $locked, 'create' => false, 'reconcile' => false];
            }

            $startedAt = $locked->mercadopago_preference_started_at;
            if ($startedAt !== null) {
                if (CarbonImmutable::parse($startedAt)->gt(now()->subMinutes(2))) {
                    abort(409, 'La creación del pago sigue en curso. Esperá unos segundos y volvé a intentarlo.');
                }

                return ['order' => $locked, 'create' => true, 'reconcile' => true];
            }

            DB::table('storefront_orders')->where('id', $locked->id)->update([
                'mercadopago_preference_started_at' => now(),
                'updated_at' => now(),
            ]);

            return ['order' => $locked, 'create' => true, 'reconcile' => false];
        });

        if (! $claim['create']) {
            return $claim['order'];
        }

        $order = $claim['order'];
        if ($claim['reconcile']) {
            $found = $this->gateway->findPreferenceByExternalReference((string) $order->external_reference);
            if ($found !== null) {
                return $this->savePreference($order, $found);
            }
        }

        $items = DB::table('storefront_order_items')
            ->where('order_id', $order->id)
            ->orderBy('inventory_item_id')
            ->get();
        $nameParts = preg_split('/\s+/', trim((string) $order->customer_name), 2) ?: [];

        $payload = [
            'items' => $items->map(static fn (object $item): array => [
                'id' => $item->sku_snapshot,
                'title' => $item->title_snapshot,
                'description' => $item->title_snapshot,
                'category_id' => 'electronics',
                'quantity' => (int) $item->quantity,
                'currency_id' => $order->currency_code,
                'unit_price' => round(((int) $item->unit_price_minor) / 100, 2),
            ])->all(),
            'payer' => [
                'first_name' => $nameParts[0] ?? (string) $order->customer_name,
                'last_name' => $nameParts[1] ?? '',
                'email' => $order->customer_email,
            ],
            'external_reference' => $order->external_reference,
            'back_urls' => [
                'success' => $this->returnUrl($order),
                'pending' => $this->returnUrl($order),
                'failure' => $this->returnUrl($order),
            ],
            'auto_return' => 'approved',
            'notification_url' => rtrim((string) config('mercadopago.public_url'), '/').'/api/v1/store/payment/mercadopago/webhook?source_news=webhooks',
            'expires' => true,
            'expiration_date_from' => now()->subSeconds(5)->toIso8601String(),
            'expiration_date_to' => CarbonImmutable::parse($order->reservation_expires_at)->toIso8601String(),
            'metadata' => ['fixphone_order_id' => (string) $order->id],
            'statement_descriptor' => 'FIXPHONE',
        ];

        $payloadHash = hash('sha256', json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '');
        DB::transaction(function () use ($order, $payloadHash): void {
            $preference = DB::table('storefront_payment_preferences')
                ->where('order_id', $order->id)
                ->lockForUpdate()
                ->first();
            $values = [
                'external_reference' => $order->external_reference,
                'status' => 'creating',
                'request_payload_hash' => $payloadHash,
                'last_error_class' => null,
                'started_at' => now(),
                'updated_at' => now(),
            ];

            if ($preference) {
                DB::table('storefront_payment_preferences')->where('id', $preference->id)->update([
                    ...$values,
                    'attempt_count' => (int) $preference->attempt_count + 1,
                ]);
            } else {
                DB::table('storefront_payment_preferences')->insert([
                    ...$values,
                    'id' => (string) Str::ulid(),
                    'order_id' => $order->id,
                    'attempt_count' => 1,
                    'created_at' => now(),
                ]);
            }
        });

        try {
            $response = $this->gateway->createPreference($payload);
            $this->assertPreferenceMatches($response, $order);

            return $this->savePreference($order, $response);
        } catch (\Throwable $exception) {
            DB::table('storefront_payment_preferences')->where('order_id', $order->id)->update([
                'status' => 'uncertain',
                'last_error_class' => get_class($exception),
                'updated_at' => now(),
            ]);
            throw $exception;
        }
    }

    public function processPayment(string $paymentId, ?array $merchantOrder = null): string
    {
        $payment = $this->gateway->getPayment($paymentId);
        $reference = trim((string) ($payment['external_reference'] ?? ''));
        if ($merchantOrder === null) {
            $merchantOrderId = $payment['order']['id'] ?? null;
            $merchantOrder = $merchantOrderId !== null
                ? $this->gateway->getMerchantOrder((string) $merchantOrderId)
                : $this->gateway->findMerchantOrderForPayment($reference, $paymentId);
        }
        if ($merchantOrder === null) {
            throw new InvalidMercadoPagoPayment('No se pudo demostrar la relación entre el pago y su orden comercial.');
        }
        $order = $this->validatePayment($paymentId, $payment, $merchantOrder);

        return DB::transaction(function () use ($payment, $merchantOrder, $order, $paymentId): string {
            $locked = DB::table('storefront_orders')->where('id', $order->id)->lockForUpdate()->first();
            if (! $locked) {
                throw new InvalidMercadoPagoPayment('La orden local ya no existe.');
            }
            $status = (string) ($payment['status'] ?? '');
            $detail = (string) ($payment['status_detail'] ?? '');
            $amountMinor = (int) round(((float) $payment['transaction_amount']) * 100);
            $preferenceId = (string) $merchantOrder['preference_id'];
            $merchantOrderId = (string) $merchantOrder['id'];
            $providerUpdatedAt = $payment['date_last_updated'] ?? $payment['date_created'] ?? null;
            $payloadHash = hash('sha256', json_encode(['payment' => $payment, 'merchant_order' => $merchantOrder], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '');
            $attempt = DB::table('storefront_payment_attempts')->where('payment_id', $paymentId)->lockForUpdate()->first();

            if ($attempt && (string) $attempt->order_id !== (string) $locked->id) {
                throw new InvalidMercadoPagoPayment('El pago ya está asociado a otra orden.');
            }
            if ($attempt && $attempt->provider_updated_at && $providerUpdatedAt
                && CarbonImmutable::parse($providerUpdatedAt)->lt(CarbonImmutable::parse($attempt->provider_updated_at))) {
                return 'stale_event_ignored';
            }
            if ($attempt && (
                ($attempt->status === 'approved' && ! in_array($status, ['approved', 'refunded', 'charged_back'], true))
                || (in_array($attempt->status, ['refunded', 'charged_back'], true) && $attempt->status !== $status)
            )) {
                return 'state_regression_ignored';
            }
            $isReplay = $attempt
                && $attempt->status === $status
                && $attempt->status_detail === $detail
                && (int) $attempt->amount_minor === $amountMinor
                && $attempt->currency_code === (string) $payment['currency_id']
                && $attempt->preference_id === $preferenceId;

            $attemptData = [
                'order_id' => $locked->id,
                'preference_id' => $preferenceId,
                'merchant_order_id' => $merchantOrderId,
                'application_id' => (string) $merchantOrder['application_id'],
                'status' => $status,
                'status_detail' => $detail,
                'amount_minor' => $amountMinor,
                'currency_code' => (string) $payment['currency_id'],
                'collector_id' => (string) $payment['collector_id'],
                'payment_method_id' => isset($payment['payment_method_id']) ? (string) $payment['payment_method_id'] : null,
                'approved_at' => $status === 'approved' ? ($payment['date_approved'] ?? now()) : null,
                'provider_updated_at' => $providerUpdatedAt,
                'provider_payload_hash' => $payloadHash,
                'updated_at' => now(),
            ];

            if ($attempt) {
                DB::table('storefront_payment_attempts')->where('payment_id', $paymentId)->update($attemptData);
            } else {
                DB::table('storefront_payment_attempts')->insert([
                    ...$attemptData,
                    'id' => (string) Str::ulid(),
                    'payment_id' => $paymentId,
                    'created_at' => now(),
                ]);
            }

            $result = $this->applyPaymentState($locked, $paymentId, $status, $detail, $amountMinor);
            DB::table('storefront_orders')->where('id', $locked->id)->update([
                'payment_status' => $status,
                'payment_status_detail' => $detail,
                'mercadopago_merchant_order_id' => $merchantOrderId,
                'payment_checked_at' => now(),
                'updated_at' => now(),
            ]);
            if (! $isReplay) {
                $this->audit($locked, 'payment.'.$status, [
                    'payment_id' => $paymentId,
                    'merchant_order_id' => $merchantOrderId,
                    'status' => $status,
                    'status_detail' => $detail,
                    'amount_minor' => $amountMinor,
                    'currency_code' => (string) $payment['currency_id'],
                    'result' => $result,
                ]);
            }

            return $result;
        });
    }

    private function applyPaymentState(object $order, string $paymentId, string $status, string $detail, int $amountMinor): string
    {
        if ($status === 'refunded') {
            return $this->markPaymentReview($order, 'refund_requires_manual_stock_review', 'refunded');
        }

        if (in_array($status, ['charged_back', 'in_mediation'], true)) {
            return $this->markPaymentReview($order, $status === 'charged_back' ? 'chargeback' : 'payment_in_mediation');
        }

        if ($status !== 'approved') {
            return 'recorded';
        }

        if ($order->stock_deducted_at !== null) {
            $anotherApprovedPayment = DB::table('storefront_payment_attempts')
                ->where('order_id', $order->id)
                ->where('payment_id', '!=', $paymentId)
                ->where('status', 'approved')
                ->exists();

            return $anotherApprovedPayment
                ? $this->markPaymentReview($order, 'duplicate_approved_payment')
                : 'already_paid';
        }

        $lines = DB::table('storefront_order_items')
            ->where('order_id', $order->id)
            ->orderBy('inventory_item_id')
            ->get();

        $items = [];
        foreach ($lines as $line) {
            $item = InventoryItem::query()->whereKey($line->inventory_item_id)->lockForUpdate()->first();
            if (! $item) {
                return $this->markPaymentReview($order, 'inventory_item_missing');
            }
            $storefrontHeld = (int) DB::table('storefront_order_items')
                ->join('storefront_orders', 'storefront_orders.id', '=', 'storefront_order_items.order_id')
                ->where('storefront_order_items.inventory_item_id', $item->id)
                ->where('storefront_orders.status', 'awaiting_payment')
                ->where('storefront_orders.reservation_expires_at', '>', now())
                ->where('storefront_orders.id', '!=', $order->id)
                ->sum('storefront_order_items.quantity');
            $commercialHeld = (int) DB::table('order_items')
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->where('order_items.inventory_item_id', $item->id)
                ->whereIn('orders.status', ['pending', 'processing', 'ready'])
                ->sum('order_items.quantity');

            if ((int) $item->stock_quantity - $storefrontHeld - $commercialHeld < (int) $line->quantity) {
                $reason = CarbonImmutable::parse($order->reservation_expires_at)->isPast()
                    ? 'late_approved_payment_stock_unavailable'
                    : 'reserved_stock_no_longer_available';

                return $this->markPaymentReview($order, $reason);
            }
            $items[] = [$item, (int) $line->quantity];
        }

        foreach ($items as [$item, $quantity]) {
            $before = (int) $item->stock_quantity;
            $after = $before - $quantity;
            DB::table('inventory_stock_adjustments')->insertOrIgnore([
                'id' => (string) Str::ulid(),
                'inventory_item_id' => $item->id,
                'request_id' => (string) Str::uuid(),
                'quantity_before' => $before,
                'quantity_delta' => -$quantity,
                'quantity_after' => $after,
                'reason' => 'Venta online '.$order->order_number,
                'source_type' => 'storefront_order',
                'source_id' => $order->id,
                'actor_id' => $order->user_id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $item->stock_quantity = $after;
            $item->save();
        }

        DB::table('storefront_orders')->where('id', $order->id)->update([
            'status' => 'paid',
            'payment_review_reason' => null,
            'stock_deducted_at' => now(),
            'paid_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('storefront_cart_lines')
            ->where('user_id', $order->user_id)
            ->whereIn('inventory_item_id', $lines->pluck('inventory_item_id'))
            ->where('updated_at', '<=', $order->created_at)
            ->delete();

        return 'paid';
    }

    private function validatePayment(string $paymentId, array $payment, array $merchantOrder): object
    {
        $collector = (string) config('mercadopago.collector_id');
        $application = (string) config('mercadopago.application_id');
        $reference = (string) ($payment['external_reference'] ?? '');
        $amount = $payment['transaction_amount'] ?? null;

        if ((string) ($payment['id'] ?? '') !== $paymentId
            || (string) ($payment['collector_id'] ?? '') !== $collector
            || ($payment['currency_id'] ?? null) !== 'UYU'
            || ! is_numeric($amount)
            || (int) round(((float) $amount) * 100) < 1
            || $reference === '') {
            throw new InvalidMercadoPagoPayment('El pago no supera las validaciones de vendedor, moneda, importe o referencia.');
        }

        if (config('app.env') === 'production' && ($payment['live_mode'] ?? false) !== true) {
            throw new InvalidMercadoPagoPayment('El pago no pertenece al entorno productivo.');
        }

        $merchantContainsPayment = collect($merchantOrder['payments'] ?? [])->contains(
            static fn ($candidate): bool => (string) data_get($candidate, 'id', '') === $paymentId,
        );
        if ((string) ($merchantOrder['external_reference'] ?? '') !== $reference
            || empty($merchantOrder['id'])
            || empty($merchantOrder['preference_id'])
            || (string) ($merchantOrder['application_id'] ?? '') !== $application
            || (string) ($merchantOrder['collector']['id'] ?? '') !== $collector
            || (isset($merchantOrder['site_id']) && (string) $merchantOrder['site_id'] !== 'MLU')
            || ! $merchantContainsPayment) {
            throw new InvalidMercadoPagoPayment('La orden comercial no demuestra que el pago pertenezca a FixPhone.');
        }

        $order = DB::table('storefront_orders')->where('external_reference', $reference)->first();
        if (! $order
            || (string) $order->mercadopago_preference_id !== (string) $merchantOrder['preference_id']
            || (int) $order->total_amount_minor !== (int) round(((float) $amount) * 100)) {
            throw new InvalidMercadoPagoPayment('El pago no coincide con una orden y preferencia de FixPhone.');
        }

        $preference = DB::table('storefront_payment_preferences')->where('order_id', $order->id)->first();
        if (! $preference
            || (string) $preference->preference_id !== (string) $merchantOrder['preference_id']
            || (string) $preference->client_id !== $application
            || (string) $preference->collector_id !== $collector) {
            throw new InvalidMercadoPagoPayment('La preferencia no tiene una vinculación local verificable.');
        }

        if (! in_array((string) ($payment['status'] ?? ''), ['approved', 'authorized', 'pending', 'in_process', 'in_mediation', 'rejected', 'cancelled', 'refunded', 'charged_back'], true)) {
            throw new InvalidMercadoPagoPayment('Mercado Pago devolvió un estado de pago no reconocido.');
        }

        return $order;
    }

    private function markPaymentReview(object $order, string $reason, string $status = 'payment_review'): string
    {
        DB::table('storefront_orders')->where('id', $order->id)->update([
            'status' => $status,
            'payment_review_reason' => $reason,
            'updated_at' => now(),
        ]);

        return $reason;
    }

    private function assertPreferenceMatches(array $preference, object $order): void
    {
        if ((string) ($preference['client_id'] ?? '') !== (string) config('mercadopago.application_id')
            || (string) ($preference['collector_id'] ?? '') !== (string) config('mercadopago.collector_id')
            || (string) ($preference['external_reference'] ?? '') !== (string) $order->external_reference
            || (isset($preference['site_id']) && (string) $preference['site_id'] !== 'MLU')
            || empty($preference['id'])
            || ! $this->isSafeCheckoutUrl((string) ($preference['init_point'] ?? ''))) {
            throw new RuntimeException('La preferencia no coincide con FixPhone o no devolvió una URL segura.');
        }

        $items = collect($preference['items'] ?? []);
        $currencyMatches = $items->isNotEmpty()
            && $items->every(static fn ($item): bool => data_get($item, 'currency_id') === 'UYU');
        $preferenceAmountMinor = (int) round(
            $items->sum(static fn ($item): float => ((float) data_get($item, 'unit_price', 0)) * ((int) data_get($item, 'quantity', 0))) * 100
        );
        if (! $currencyMatches || $preferenceAmountMinor !== (int) $order->total_amount_minor) {
            throw new RuntimeException('El importe de la preferencia no coincide con la orden.');
        }
    }

    private function savePreference(object $order, array $preference): object
    {
        $this->assertPreferenceMatches($preference, $order);
        DB::table('storefront_orders')->where('id', $order->id)->update([
            'mercadopago_preference_id' => (string) $preference['id'],
            'mercadopago_checkout_url' => (string) $preference['init_point'],
            'payment_status' => 'preference_created',
            'payment_status_detail' => null,
            'updated_at' => now(),
        ]);
        DB::table('storefront_payment_preferences')->where('order_id', $order->id)->update([
            'preference_id' => (string) $preference['id'],
            'client_id' => (string) $preference['client_id'],
            'collector_id' => (string) $preference['collector_id'],
            'status' => 'completed',
            'checkout_url' => (string) $preference['init_point'],
            'response_payload_hash' => hash('sha256', json_encode($preference, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: ''),
            'last_error_class' => null,
            'completed_at' => now(),
            'updated_at' => now(),
        ]);

        $saved = DB::table('storefront_orders')->where('id', $order->id)->first();
        if (! $saved) {
            abort(404);
        }

        return $saved;
    }

    private function isSafeCheckoutUrl(string $url): bool
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));

        return parse_url($url, PHP_URL_SCHEME) === 'https'
            && in_array($host, [
                'www.mercadopago.com.uy',
                'mercadopago.com.uy',
                'www.mercadopago.com',
                'mercadopago.com',
            ], true);
    }

    private function isPublicHttpsUrl(string $url): bool
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));

        return parse_url($url, PHP_URL_SCHEME) === 'https'
            && $host !== ''
            && $host !== 'localhost'
            && filter_var($host, FILTER_VALIDATE_IP) === false;
    }

    private function returnUrl(object $order): string
    {
        return rtrim((string) config('mercadopago.public_url'), '/').'/store/payment/return?order_id='.urlencode((string) $order->id);
    }

    private function audit(object $order, string $eventType, array $metadata): void
    {
        DB::table('audit_events')->insert([
            'id' => (string) Str::ulid(),
            'event_type' => 'storefront.'.$eventType,
            'action' => 'payment_update',
            'entity_type' => 'StorefrontOrder',
            'entity_id' => $order->id,
            'actor_type' => 'system',
            'actor_id' => 'mercadopago',
            'correlation_id' => null,
            'metadata' => json_encode($metadata, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            'occurred_at' => now(),
        ]);
    }
}
