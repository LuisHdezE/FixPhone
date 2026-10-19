<?php

namespace App\Infrastructure\Storefront;

use Illuminate\Http\Request;

final class MercadoPagoWebhookSignature
{
    public function isValid(Request $request, string $dataId): bool
    {
        $secret = (string) config('mercadopago.webhook_secret');
        $signature = $request->header('x-signature');
        $requestId = $request->header('x-request-id');

        if ($secret === '' || ! is_string($signature) || ! is_string($requestId) || $requestId === '') {
            return false;
        }

        $parts = [];
        foreach (explode(',', $signature) as $part) {
            [$key, $value] = array_pad(explode('=', trim($part), 2), 2, '');
            $parts[$key] = $value;
        }

        $timestamp = $parts['ts'] ?? '';
        $received = strtolower($parts['v1'] ?? '');
        if (! ctype_digit($timestamp) || ! preg_match('/^[a-f0-9]{64}$/', $received)) {
            return false;
        }

        $manifest = 'id:'.strtolower($dataId).';request-id:'.$requestId.';ts:'.$timestamp.';';
        $expected = hash_hmac('sha256', $manifest, $secret);

        return hash_equals($expected, $received);
    }
}
