<?php

namespace App\Presentation\Http\Controllers\Storefront;

use App\Infrastructure\Identity\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class StorefrontOrderStatusController
{
    public function show(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->active, 403);

        $order = DB::table('storefront_orders')
            ->where('id', $id)
            ->where('user_id', $user->getAuthIdentifier())
            ->first();

        abort_unless($order, 404);

        return response()->json(['data' => [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'status' => $order->status,
            'payment_status' => $order->payment_status,
            'payment_status_detail' => $order->payment_status_detail,
            'total_amount_minor' => (int) $order->total_amount_minor,
            'currency_code' => $order->currency_code,
            'reservation_expires_at' => $order->reservation_expires_at,
            'paid_at' => $order->paid_at,
        ]])->header('Cache-Control', 'no-store');
    }
}
