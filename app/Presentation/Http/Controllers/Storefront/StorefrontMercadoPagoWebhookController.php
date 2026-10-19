<?php

namespace App\Presentation\Http\Controllers\Storefront;

use App\Infrastructure\Storefront\InvalidMercadoPagoPayment;
use App\Infrastructure\Storefront\MercadoPagoWebhookSignature;
use App\Infrastructure\Storefront\StorefrontMercadoPagoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

final class StorefrontMercadoPagoWebhookController
{
    public function __invoke(
        Request $request,
        MercadoPagoWebhookSignature $signature,
        StorefrontMercadoPagoService $payments,
    ): JsonResponse {
        $paymentId = (string) ($request->input('data.id') ?? $request->query('data.id') ?? $request->query('data_id') ?? $request->input('id', ''));
        if (! preg_match('/^[0-9]{1,40}$/', $paymentId) || ! $signature->isValid($request, $paymentId)) {
            return response()->json(['received' => false], 401);
        }

        $type = (string) ($request->input('type') ?? $request->query('type') ?? $request->query('topic', ''));
        if ($type !== '' && ! in_array($type, ['payment', 'payments'], true)) {
            return response()->json(['received' => true]);
        }

        try {
            $result = $payments->processPayment($paymentId);
            return response()->json(['received' => true, 'result' => $result]);
        } catch (InvalidMercadoPagoPayment $exception) {
            Log::warning('Mercado Pago notification did not match a FixPhone order.', [
                'payment_id' => $paymentId,
                'reason' => $exception->getMessage(),
            ]);
            return response()->json(['received' => true]);
        } catch (Throwable $exception) {
            Log::warning('Mercado Pago notification processing failed.', [
                'payment_id' => $paymentId,
                'exception' => get_class($exception),
            ]);
            return response()->json(['received' => false], 500);
        }
    }
}
