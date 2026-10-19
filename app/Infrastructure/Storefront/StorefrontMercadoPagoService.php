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
        private readonly MercadoPagoApiClient $client,
        private readonly StorefrontOrderService $orders,
    ) {
    }

    public function isReady(): bool
    {
        return (bool) config('mercadopago.enabled')
            && (string) config('mercadopago.access_token') !== ''
            && (string) config('mercadopago.webhook_secret') !== ''
            && (string) config('mercadopago.collector_id') !== '';
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
            $found = $this->findExistingPreference($order);
            if ($found !== null) {
                return $this->savePreference($order, $found);
            }
        }

        $items = DB::table('storefront_order_items')
            ->where('order_id', $order->id)
            ->orderBy('inventory_item_id')
            ->get();

        $payload = [
            'items' => $items->map(static fn (object $item): array => [
                'id' => $item->sku_snapshot,
                'title' => $item->title_snapshot,
                'quantity' => (int) $item->quantity,
                'currency_id' => $order->currency_code,
                'unit_price' => round(((int) $item->unit_price_minor) / 100, 2),
            ])->all(),
            'payer' => ['email' => $order->customer_email],
            'external_reference' => $order->external_reference,
            'back_urls' => [
                'success' => $this->returnUrl($order),
                'pending' => $this->returnUrl($order),
                'failure' => $this->returnUrl($order),
            ],
            'auto_return' => 'approved',
            'notification_url' => rtrim((string) config('app.url'), '/').'/api/v1/store/payment/mercadopago/webhook',
            'expires' => true,
            'expiration_date_from' => now()->subSeconds(5)->toIso8601String(),
            'expiration_date_to' => CarbonImmutable::parse($order->reservation_expires_at)->toIso8601String(),
            'metadata' => ['fixphone_order_id' => (string) $order->id],
        ];

        $response = $this->client->createPreference($payload);
        $this->assertPreferenceMatches($response, $order);

        return $this->savePreference($order, $response);
    }

    public function processPayment(string $paymentId): string
    {
        $payment = $this->client->getPayment($paymentId);
        $order = $this->validatePayment($payment);

        return DB::transaction(function () use ($payment, $order, $paymentId): string {
            $locked = DB::table('storefront_orders')->where('id', $order->id)->lockForUpdate()->first();
            if (! $locked) {
                throw new InvalidMercadoPagoPayment('La orden local ya no existe.');
            }
            $status = (string) ($payment['status'] ?? '');
            $detail = (string) ($payment['status_detail'] ?? '');
            $amountMinor = (int) round(((float) $payment['transaction_amount']) * 100);
            $payloadHash = hash('sha256', json_encode($payment, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '');
            $attempt = DB::table('storefront_payment_attempts')->where('payment_id', $paymentId)->lockForUpdate()->first();

            if ($attempt && (string) $attempt->order_id !== (string) $locked->id) {
                throw new InvalidMercadoPagoPayment('El pago ya está asociado a otra orden.');
            }
            $isReplay = $attempt
                && $attempt->status === $status
                && $attempt->status_detail === $detail
                && (int) $attempt->amount_minor === $amountMinor
                && $attempt->currency_code === (string) $payment['currency_id']
                && $attempt->preference_id === (string) $payment['preference_id'];

            $attemptData = [
                'order_id' => $locked->id,
                'preference_id' => (string) $payment['preference_id'],
                'status' => $status,
                'status_detail' => $detail,
                'amount_minor' => $amountMinor,
                'currency_code' => (string) $payment['currency_id'],
                'collector_id' => (string) $payment['collector_id'],
                'payment_method_id' => isset($payment['payment_method_id']) ? (string) $payment['payment_method_id'] : null,
                'approved_at' => $status === 'approved' ? ($payment['date_approved'] ?? now()) : null,
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
                'payment_checked_at' => now(),
                'updated_at' => now(),
            ]);
            if (! $isReplay) {
                $this->audit($locked, 'payment.'.$status, [
                    'payment_id' => $paymentId,
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
            DB::table('storefront_orders')->where('id', $order->id)->update([
                'status' => 'refunded',
                'updated_at' => now(),
            ]);
            return 'refunded';
        }

        if ($status === 'charged_back') {
            return $this->markPaymentReview($order, 'chargeback');
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

            return $anotherApprovedPayment ? 'duplicate_approved_payment' : 'already_paid';
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
                return $this->markPaymentReview($order, 'reserved_stock_no_longer_available');
            }
            $items[] = [$item, (int) $line->quantity];
        }

        foreach ($items as [$item, $quantity]) {
            $item->stock_quantity = (int) $item->stock_quantity - $quantity;
            $item->save();
        }

        DB::table('storefront_orders')->where('id', $order->id)->update([
            'status' => 'paid',
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

    private function validatePayment(array $payment): object
    {
        $collector = (string) config('mercadopago.collector_id');
        $reference = (string) ($payment['external_reference'] ?? '');
        $preferenceId = (string) ($payment['preference_id'] ?? '');
        $amount = $payment['transaction_amount'] ?? null;

        if ((string) ($payment['collector_id'] ?? '') !== $collector
            || ($payment['currency_id'] ?? null) !== 'UYU'
            || ! is_numeric($amount)
            || (int) round(((float) $amount) * 100) < 1
            || $reference === ''
            || $preferenceId === '') {
            throw new InvalidMercadoPagoPayment('El pago no supera las validaciones de vendedor, moneda, importe o referencia.');
        }

        if (config('app.env') === 'production' && ($payment['live_mode'] ?? false) !== true) {
            throw new InvalidMercadoPagoPayment('El pago no pertenece al entorno productivo.');
        }

        $order = DB::table('storefront_orders')->where('external_reference', $reference)->first();
        if (! $order
            || (string) $order->mercadopago_preference_id !== $preferenceId
            || (int) $order->total_amount_minor !== (int) round(((float) $amount) * 100)) {
            throw new InvalidMercadoPagoPayment('El pago no coincide con una orden y preferencia de FixPhone.');
        }

        if (! in_array((string) ($payment['status'] ?? ''), ['approved', 'pending', 'in_process', 'rejected', 'cancelled', 'refunded', 'charged_back'], true)) {
            throw new InvalidMercadoPagoPayment('Mercado Pago devolvió un estado de pago no reconocido.');
        }

        return $order;
    }

    private function markPaymentReview(object $order, string $reason): string
    {
        DB::table('storefront_orders')->where('id', $order->id)->update([
            'status' => 'payment_review',
            'updated_at' => now(),
        ]);
        return $reason;
    }

    private function findExistingPreference(object $order): ?array
    {
        $response = $this->client->searchPreferences((string) $order->external_reference);
        foreach (($response['elements'] ?? []) as $preference) {
            if ((string) ($preference['external_reference'] ?? '') === (string) $order->external_reference
                && (string) ($preference['collector_id'] ?? '') === (string) config('mercadopago.collector_id')
                && ! empty($preference['id'])
                && ! empty($preference['init_point'])) {
                return $preference;
            }
        }

        return null;
    }

    private function assertPreferenceMatches(array $preference, object $order): void
    {
        if ((string) ($preference['collector_id'] ?? '') !== (string) config('mercadopago.collector_id')
            || (string) ($preference['external_reference'] ?? '') !== (string) $order->external_reference
            || empty($preference['id'])
            || ! $this->isSafeCheckoutUrl((string) ($preference['init_point'] ?? ''))) {
            throw new RuntimeException('La preferencia no coincide con FixPhone o no devolvió una URL segura.');
        }

        if (isset($preference['items'])) {
            $items = collect($preference['items']);
            $currencyMatches = $items->every(static fn (array $item): bool => ($item['currency_id'] ?? null) === 'UYU');
            $preferenceAmountMinor = (int) round(
                $items->sum(static fn (array $item): float => ((float) ($item['unit_price'] ?? 0)) * ((int) ($item['quantity'] ?? 0))) * 100
            );
            if (! $currencyMatches || $preferenceAmountMinor !== (int) $order->total_amount_minor) {
                throw new RuntimeException('El importe de la preferencia no coincide con la orden.');
            }
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
                'sandbox.mercadopago.com.uy',
                'www.mercadopago.com',
                'mercadopago.com',
                'sandbox.mercadopago.com',
            ], true);
    }

    private function returnUrl(object $order): string
    {
        return rtrim((string) config('app.url'), '/').'/store/payment/return?order_id='.urlencode((string) $order->id);
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
