<?php

use App\Infrastructure\Storefront\MercadoPagoNotificationProcessor;
use App\Infrastructure\Storefront\StorefrontMercadoPagoService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('fixphone:about', function (): void {
    $this->info('FixPhone API foundation is installed.');
});

Artisan::command('mercadopago:process-notifications {--limit=50} {--reconcile=25}', function (MercadoPagoNotificationProcessor $processor): int {
    $summary = $processor->processPending((int) $this->option('limit'));
    $summary['reconciled_payments'] = $processor->reconcileOpenOrders((int) $this->option('reconcile'));
    $this->line(json_encode($summary, JSON_UNESCAPED_SLASHES));

    return self::SUCCESS;
})->purpose('Procesa la bandeja durable y reconcilia pagos de Mercado Pago.');

Artisan::command('mercadopago:check-config', function (StorefrontMercadoPagoService $payments): int {
    $ready = $payments->isReady();
    $valid = $payments->configurationValid();
    $this->line(json_encode([
        'ready' => $ready,
        'configuration_valid' => $valid,
        'enabled' => (bool) config('mercadopago.enabled'),
        'application_id' => (string) config('mercadopago.application_id'),
        'public_url' => (string) config('mercadopago.public_url'),
        'site_id' => (string) config('mercadopago.site_id'),
        'currency' => (string) config('mercadopago.currency'),
    ], JSON_UNESCAPED_SLASHES));

    return $valid ? self::SUCCESS : self::FAILURE;
})->purpose('Valida la configuración sin mostrar secretos.');

Schedule::command('mercadopago:process-notifications')->everyMinute()->withoutOverlapping();
