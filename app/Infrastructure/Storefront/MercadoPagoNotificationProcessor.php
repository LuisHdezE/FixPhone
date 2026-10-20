<?php

namespace App\Infrastructure\Storefront;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Throwable;

final class MercadoPagoNotificationProcessor
{
    public function __construct(
        private readonly MercadoPagoGateway $gateway,
        private readonly StorefrontMercadoPagoService $payments,
        private readonly StorefrontOrderService $orders,
    ) {}

    public function processPending(?int $limit = null): array
    {
        $limit ??= (int) config('mercadopago.notification_batch_size', 50);
        $summary = ['processed' => 0, 'failed' => 0, 'expired_orders' => $this->orders->expireReservations()];

        $ids = DB::table('mercadopago_notifications')
            ->whereNull('processed_at')
            ->where('available_at', '<=', now())
            ->where(static function ($query): void {
                $query->whereNull('processing_started_at')
                    ->orWhere('processing_started_at', '<=', now()->subMinutes(10));
            })
            ->orderBy('received_at')
            ->limit(max(1, min($limit, 200)))
            ->pluck('id');

        foreach ($ids as $id) {
            $notification = DB::transaction(function () use ($id): ?object {
                $row = DB::table('mercadopago_notifications')->where('id', $id)->lockForUpdate()->first();
                if (! $row || $row->processed_at !== null
                    || ($row->processing_started_at !== null && CarbonImmutable::parse($row->processing_started_at)->gt(now()->subMinutes(10)))) {
                    return null;
                }

                DB::table('mercadopago_notifications')->where('id', $id)->update([
                    'processing_started_at' => now(),
                    'attempts' => (int) $row->attempts + 1,
                    'updated_at' => now(),
                ]);

                return $row;
            });

            if (! $notification) {
                continue;
            }

            try {
                $this->process($notification);
                DB::table('mercadopago_notifications')->where('id', $id)->update([
                    'processed_at' => now(),
                    'processing_started_at' => null,
                    'last_error' => null,
                    'updated_at' => now(),
                ]);
                $summary['processed']++;
            } catch (InvalidMercadoPagoPayment $exception) {
                DB::table('mercadopago_notifications')->where('id', $id)->update([
                    'processed_at' => now(),
                    'processing_started_at' => null,
                    'last_error' => mb_substr(get_class($exception).': '.$exception->getMessage(), 0, 1000),
                    'updated_at' => now(),
                ]);
                $summary['processed']++;
            } catch (Throwable $exception) {
                $attempts = (int) $notification->attempts + 1;
                DB::table('mercadopago_notifications')->where('id', $id)->update([
                    'processing_started_at' => null,
                    'available_at' => now()->addMinutes(min(60, 2 ** min($attempts, 6))),
                    'last_error' => mb_substr(get_class($exception).': '.$exception->getMessage(), 0, 1000),
                    'updated_at' => now(),
                ]);
                $summary['failed']++;
            }
        }

        return $summary;
    }

    public function reconcileOpenOrders(int $limit = 25): int
    {
        $count = 0;
        $orders = DB::table('storefront_orders')
            ->whereNotNull('mercadopago_preference_id')
            ->whereIn('status', ['awaiting_payment', 'payment_review'])
            ->orderBy('payment_checked_at')
            ->limit(max(1, min($limit, 100)))
            ->get();

        foreach ($orders as $order) {
            try {
                $merchantOrder = $this->gateway->findMerchantOrderByExternalReference((string) $order->external_reference);
                if ($merchantOrder === null) {
                    continue;
                }
                foreach (($merchantOrder['payments'] ?? []) as $payment) {
                    if (! empty($payment['id'])) {
                        $this->payments->processPayment((string) $payment['id'], $merchantOrder);
                        $count++;
                    }
                }
            } catch (Throwable) {
                continue;
            }
        }

        return $count;
    }

    private function process(object $notification): void
    {
        $expectedApplication = (string) config('mercadopago.application_id');
        if ($notification->application_id !== null && (string) $notification->application_id !== $expectedApplication) {
            throw new InvalidMercadoPagoPayment('La notificación pertenece a otra aplicación.');
        }
        if (config('app.env') === 'production' && $notification->live_mode !== null && ! (bool) $notification->live_mode) {
            throw new InvalidMercadoPagoPayment('La notificación no pertenece al entorno productivo.');
        }

        if ($notification->topic === 'payment') {
            $this->payments->processPayment((string) $notification->resource_id);

            return;
        }

        if ($notification->topic === 'merchant_order') {
            $merchantOrder = $this->gateway->getMerchantOrder((string) $notification->resource_id);
            foreach (($merchantOrder['payments'] ?? []) as $payment) {
                if (! empty($payment['id'])) {
                    $this->payments->processPayment((string) $payment['id'], $merchantOrder);
                }
            }

            return;
        }

        if ($notification->topic === 'chargeback') {
            $chargeback = $this->gateway->getChargeback((string) $notification->resource_id);
            if (empty($chargeback['payment_id'])) {
                throw new InvalidMercadoPagoPayment('El contracargo no identifica un pago.');
            }
            $this->payments->processPayment((string) $chargeback['payment_id']);
        }
    }
}
