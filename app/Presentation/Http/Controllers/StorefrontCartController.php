<?php
namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Identity\User;
use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\Inventory\StorefrontCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class StorefrontCartController
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->active, 403);
        $rows = DB::table('storefront_cart_lines')->where('user_id', $request->user()->getAuthIdentifier())->orderBy('id')->get();
        $ids = $rows->pluck('inventory_item_id');
        $items = InventoryItem::query()->whereIn('id', $ids)->get()->keyBy('id');
        $available = StorefrontCatalog::query()->whereIn('id', $ids)->pluck('id')->all();
        $lines = $rows->map(function ($row) use ($items, $available): array {
            $item = $items->get($row->inventory_item_id);
            $stock = $item && in_array($item->id, $available, true) ? $item->stock_quantity : 0;
            return ['product_id' => $row->inventory_item_id, 'title' => $item?->title ?? 'Producto no disponible',
                'quantity' => $row->quantity, 'stock_quantity' => $stock,
                'image_url' => $item?->main_image_url,
                'available' => $stock >= $row->quantity,
                'unit_price_minor' => $item?->sale_price_amount_minor ?? 0,
                'currency_code' => $item?->currency_code ?? 'UYU'];
        });
        return response()->json(['data' => ['lines' => $lines]])->header('Cache-Control', 'no-store');
    }

    public function add(Request $request): JsonResponse { return $this->save($request, true); }
    public function update(Request $request, string $product): JsonResponse { return $this->save($request, false, $product); }

    private function save(Request $request, bool $increment, ?string $product = null): JsonResponse
    {
        abort_unless($request->user()->active, 403);
        $input = $request->validate([
            'product_id' => [$increment ? 'required' : 'sometimes', 'string', 'max:26'],
            'quantity' => ['required', 'integer', 'min:1', 'max:999'],
        ]);
        $product ??= $input['product_id'];
        DB::transaction(function () use ($request, $product, $input, $increment): void {
            $userId = $request->user()->getAuthIdentifier();
            // Serialize changes to this user's cart, including the first insertion.
            User::query()->whereKey($userId)->lockForUpdate()->firstOrFail();
            $item = StorefrontCatalog::query()->whereKey($product)->lockForUpdate()->first();
            if (!$item) throw ValidationException::withMessages(['product_id' => 'El producto ya no está disponible.']);
            $line = DB::table('storefront_cart_lines')->where('user_id', $userId)->where('inventory_item_id', $product);
            $current = $line->first();
            if (!$increment && !$current) abort(404);
            $quantity = $input['quantity'] + ($increment ? ($current?->quantity ?? 0) : 0);
            if ($quantity > min($item->stock_quantity, 999)) {
                throw ValidationException::withMessages(['quantity' => 'La cantidad supera el stock disponible.']);
            }
            if ($current) $line->update(['quantity' => $quantity, 'updated_at' => now()]);
            else $line->insert(['user_id' => $userId, 'inventory_item_id' => $product, 'quantity' => $quantity,
                'created_at' => now(), 'updated_at' => now()]);
        });
        return $this->index($request);
    }

    public function remove(Request $request, string $product): JsonResponse
    {
        abort_unless($request->user()->active, 403);
        DB::table('storefront_cart_lines')->where('user_id', $request->user()->getAuthIdentifier())
            ->where('inventory_item_id', $product)->delete();
        return $this->index($request);
    }
}
