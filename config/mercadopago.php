<?php

return [
    'enabled' => filter_var(env('MERCADOPAGO_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
    'access_token' => env('MERCADOPAGO_ACCESS_TOKEN'),
    'webhook_secret' => env('MERCADOPAGO_WEBHOOK_SECRET'),
    'collector_id' => env('MERCADOPAGO_COLLECTOR_ID'),
    'integrator_id' => env('MERCADOPAGO_INTEGRATOR_ID'),
    'api_url' => 'https://api.mercadopago.com',
    'reservation_minutes' => 30,
    'request_timeout_seconds' => 8,
];
