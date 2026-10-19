<?php

namespace App\Presentation\Http\Controllers\Storefront;

use App\Infrastructure\Identity\User;
use App\Infrastructure\Storefront\StorefrontOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

final class StorefrontCheckoutController
{
    public function store(Request $request, StorefrontOrderService $orders): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->active, 403);

        $validated = Validator::make(
            ['idempotency_key' => $request->header('Idempotency-Key')],
            ['idempotency_key' => ['required', 'string', 'min:16', 'max:128', 'regex:/^[A-Za-z0-9._:-]+$/']]
        )->validate();

        $result = $orders->createFromCart($user, $validated['idempotency_key']);

        return response()->json([
            'data' => [
                ...$orders->present($result['order']),
                'payment_initiated' => false,
                'next_step' => 'payment_provider',
            ],
        ], $result['created'] ? 201 : 200)->header('Cache-Control', 'no-store');
    }
}
