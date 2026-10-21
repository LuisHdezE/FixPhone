<?php

namespace App\Infrastructure\Storefront;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class MercadoPagoNotificationInbox
{
    public function store(Request $request, string $topic, string $resourceId): void
    {
        $payload = $request->all();
        $requestId = trim((string) $request->header('x-request-id'));
        $encoded = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '{}';

        DB::table('mercadopago_notifications')->insertOrIgnore([
            'id' => (string) Str::ulid(),
            'request_id' => $requestId,
            'provider_notification_id' => isset($payload['id']) ? (string) $payload['id'] : null,
            'topic' => $topic,
            'action' => isset($payload['action']) ? (string) $payload['action'] : null,
            'resource_id' => $resourceId,
            'application_id' => isset($payload['application_id']) ? (string) $payload['application_id'] : null,
            'live_mode' => array_key_exists('live_mode', $payload) ? (bool) $payload['live_mode'] : null,
            'payload' => $encoded,
            'payload_hash' => hash('sha256', $encoded),
            'attempts' => 0,
            'received_at' => now(),
            'available_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
