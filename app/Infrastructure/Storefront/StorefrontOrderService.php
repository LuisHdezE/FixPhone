<?php

namespace App\Infrastructure\Storefront;

use App\Infrastructure\Identity\User;
use App\Infrastructure\Inventory\StorefrontCatalog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class StorefrontOrderService
{
    private const RESERVATION_MINUTES = 30;

    /**
     * Create an internal order from the authoritative server-side cart.
     *
     * The idempotency key is supplied by the client, but prices, products,
     * quantities, currency, customer and totals always come from FixPhone.
     */
    public function createFromCart(User $user, string $idempotencyKey): array
    {
        if (! $user->active) {
            abort(403);
        }

        return DB::transaction(function () use ($user, $idempotencyKey): array {
            $userId = (string) $user->getAuthIdentifier();
            User::query()->whereKey($userId)->lockForUpdate()->firstOrFail();

            DB::table('storefront_orders')
                ->where('status', 'awaiting_payment')
                ->whereNotNull('reservation_expires_at')
                ->where('reservation_expires_at', '<=', now())
                ->update(['status' => 'expired', 'updated_at' => now()]);

            $keyHash = hash('sha256', $idempotencyKey);
            $existing = DB::table('storefront_orders')
                ->where('user_id', $userId)
                ->where('idempotency_key_hash', $keyHash)
                ->first();

            if ($existing) {
                return ['order' => $existing, 'created' => false];
            }

            $cart = DB::table('storefront_cart_lines')
                ->where('user_id', $userId)
                ->orderBy('inventory_item_id')
                ->get();

            if ($cart->isEmpty()) {
                throw ValidationException::withMessages(['cart' => 'El carrito está vacío.']);
            }

            $cartFingerprint = hash('sha256', $cart
                ->map(fn ($line): string => $line->inventory_item_id.':'.(int) $line->quantity)
                ->implode('|'));
            $matchingOrder = DB::table('storefront_orders')
                ->where('user_id', $userId)
                ->where('status', 'awaiting_payment')
                ->where('reservation_expires_at', '>', now())
                ->where('cart_fingerprint', $cartFingerprint)
                ->orderByDesc('created_at')
                ->first();

            if ($matchingOrder) {
                DB::table('storefront_orders')->where('id', $matchingOrder->id)->update([
                    'idempotency_key_hash' => $keyHash,
                    'updated_at' => now(),
                ]);

                return [
                    'order' => DB::table('storefront_orders')->where('id', $matchingOrder->id)->first(),
                    'created' => false,
                ];
            }

            $orderId = (string) Str::ulid();
            $externalReference = 'FPSTORE-'.$orderId;
            $items = [];
            $total = 0;

            foreach ($cart as $cartLine) {
                $item = StorefrontCatalog::query()
                    ->whereKey($cartLine->inventory_item_id)
                    ->lockForUpdate()
                    ->first();

                $quantity = (int) $cartLine->quantity;
                if (! $item || $quantity < 1 || $item->currency_code !== 'UYU') {
                    throw ValidationException::withMessages([
                        'cart' => 'Un producto dejó de estar disponible o no tiene moneda UYU.',
                    ]);
                }

                $storefrontReserved = (int) DB::table('storefront_order_items')
                    ->join('storefront_orders', 'storefront_orders.id', '=', 'storefront_order_items.order_id')
                    ->where('storefront_order_items.inventory_item_id', $item->id)
                    ->where('storefront_orders.status', 'awaiting_payment')
                    ->where('storefront_orders.reservation_expires_at', '>', now())
                    ->sum('storefront_order_items.quantity');

                $commercialReserved = (int) DB::table('order_items')
                    ->join('orders', 'orders.id', '=', 'order_items.order_id')
                    ->where('order_items.inventory_item_id', $item->id)
                    ->whereIn('orders.status', ['pending', 'processing', 'ready'])
                    ->sum('order_items.quantity');

                if ((int) $item->stock_quantity - $storefrontReserved - $commercialReserved < $quantity) {
                    throw ValidationException::withMessages([
                        'cart' => 'La cantidad solicitada ya no está disponible.',
                    ]);
                }

                $unitPrice = (int) $item->sale_price_amount_minor;
                if ($unitPrice < 1 || $unitPrice > intdiv(PHP_INT_MAX, $quantity)) {
                    throw ValidationException::withMessages([
                        'cart' => 'El precio de un producto no permite crear una orden válida.',
                    ]);
                }

                $lineTotal = $unitPrice * $quantity;
                if ($total > PHP_INT_MAX - $lineTotal) {
                    throw ValidationException::withMessages([
                        'cart' => 'El total supera el límite permitido.',
                    ]);
                }

                $total += $lineTotal;
                $items[] = [
                    'id' => (string) Str::ulid(),
                    'order_id' => $orderId,
                    'inventory_item_id' => $item->id,
                    'sku_snapshot' => $item->sku,
                    'title_snapshot' => $item->title,
                    'quantity' => $quantity,
                    'unit_price_minor' => $unitPrice,
                    'line_total_minor' => $lineTotal,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            $now = now();
            DB::table('storefront_orders')->insert([
                'id' => $orderId,
                'order_number' => 'FP-'.strtoupper(substr($orderId, -12)),
                'user_id' => $userId,
                'customer_name' => $user->name,
                'customer_email' => $user->email,
                'status' => 'awaiting_payment',
                'currency_code' => 'UYU',
                'total_amount_minor' => $total,
                'external_reference' => $externalReference,
                'idempotency_key_hash' => $keyHash,
                'cart_fingerprint' => $cartFingerprint,
                'reservation_expires_at' => $now->copy()->addMinutes(self::RESERVATION_MINUTES),
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('storefront_order_items')->insert($items);

            return [
                'order' => DB::table('storefront_orders')->where('id', $orderId)->first(),
                'created' => true,
            ];
        });
    }

    public function present(object $order): array
    {
        return [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'status' => $order->status,
            'total_amount_minor' => (int) $order->total_amount_minor,
            'currency_code' => $order->currency_code,
            'external_reference' => $order->external_reference,
            'reservation_expires_at' => $order->reservation_expires_at,
        ];
    }
}
