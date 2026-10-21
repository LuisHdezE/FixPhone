<?php

namespace App\Presentation\Http\Controllers\Storefront;

use App\Infrastructure\Identity\User;
use App\Infrastructure\Storefront\StorefrontMercadoPagoService;
use App\Infrastructure\Storefront\StorefrontOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Throwable;

final class StorefrontCheckoutController
{
    public function store(
        Request $request,
        StorefrontOrderService $orders,
        StorefrontMercadoPagoService $payments,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->active, 403);

        $validated = Validator::make(
            ['idempotency_key' => $request->header('Idempotency-Key')],
            ['idempotency_key' => ['required', 'string', 'min:16', 'max:128', 'regex:/^[A-Za-z0-9._:-]+$/']]
        )->validate();

        if ((bool) config('mercadopago.enabled') && ! $payments->configurationValid()) {
            return response()->json(['message' => 'La configuración de Mercado Pago está incompleta o no es segura.'], 503)
                ->header('Cache-Control', 'no-store');
        }

        $result = $orders->createFromCart($user, $validated['idempotency_key']);
        $order = $result['order'];
        $paymentInitiated = false;
        $checkoutUrl = null;
        $preferenceId = null;

        try {
            if ($payments->isReady()) {
                $order = $payments->ensurePreference($order);
                $paymentInitiated = (bool) $order->mercadopago_preference_id;
                $checkoutUrl = $order->mercadopago_checkout_url;
                $preferenceId = $order->mercadopago_preference_id;
            }
        } catch (Throwable $exception) {
            Log::warning('FixPhone could not initialize Mercado Pago checkout.', [
                'order_id' => $order->id,
                'exception' => get_class($exception),
            ]);

            return response()->json([
                'message' => 'No se pudo iniciar el pago. La orden quedó protegida temporalmente; volvé a intentarlo.',
            ], 502)->header('Cache-Control', 'no-store');
        }

        return response()->json([
            'data' => [
                ...$orders->present($order),
                'preference_id' => $preferenceId,
                'checkout_url' => $checkoutUrl,
                'payment_initiated' => $paymentInitiated,
                'next_step' => $paymentInitiated ? 'redirect_to_checkout' : 'payment_provider',
            ],
        ], $result['created'] ? 201 : 200)->header('Cache-Control', 'no-store');
    }
}
