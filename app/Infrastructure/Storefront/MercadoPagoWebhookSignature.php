<?php

namespace App\Infrastructure\Storefront;

use Illuminate\Http\Request;
use MercadoPago\Webhook\WebhookSignatureValidator;
use Throwable;

final class MercadoPagoWebhookSignature
{
    public function isValid(Request $request, string $dataId): bool
    {
        $secret = (string) config('mercadopago.webhook_secret');
        if ($secret === '') {
            return false;
        }

        try {
            WebhookSignatureValidator::validate(
                $request->header('x-signature'),
                $request->header('x-request-id'),
                $dataId,
                $secret,
            );
        } catch (Throwable) {
            return false;
        }

        return true;
    }
}
