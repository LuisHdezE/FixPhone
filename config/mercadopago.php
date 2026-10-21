<?php

return [
    'enabled' => filter_var(env('MERCADOPAGO_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
    'access_token' => env('MERCADOPAGO_ACCESS_TOKEN'),
    'webhook_secret' => env('MERCADOPAGO_WEBHOOK_SECRET'),
    'application_id' => env('MERCADOPAGO_APPLICATION_ID'),
    'collector_id' => env('MERCADOPAGO_COLLECTOR_ID'),
    'integrator_id' => env('MERCADOPAGO_INTEGRATOR_ID'),
    'public_url' => env('MERCADOPAGO_PUBLIC_URL'),
    'site_id' => env('MERCADOPAGO_SITE_ID', 'MLU'),
    'currency' => env('MERCADOPAGO_CURRENCY', 'UYU'),
    'reservation_minutes' => 30,
    'request_timeout_milliseconds' => 8000,
    'notification_batch_size' => 50,
];
