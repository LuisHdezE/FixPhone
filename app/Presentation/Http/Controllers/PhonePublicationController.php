<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class PhonePublicationController extends Controller
{
    private function summary(InventoryItem $item): array
    {
        return [
            'id' => $item->id, 'sku' => $item->sku, 'title' => $item->title,
            'description' => $item->description,
            'price_minor' => $item->sale_price_amount_minor,
            'currency' => $item->currency_code, 'image_url' => $item->main_image_url,
            'published' => $item->publication_status === 'publicado'
                && ($item->metadata['destination'] ?? null) === 'Direct Sale',
            'stock_quantity' => $item->stock_quantity,
            'destination' => $item->metadata['destination'] ?? null,
        ];
    }

    public function show(string $id)
    {
        $item = InventoryItem::query()->whereIn('item_type', ['device', 'used_phone'])->findOrFail($id);
        return response()->json(['data' => $this->summary($item)])->header('Cache-Control', 'no-store');
    }

    public function update(Request $request, string $id)
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'min:10', 'max:4000'],
            'price_minor' => ['nullable', 'integer', 'min:1', 'max:2147483647'],
            'currency' => ['required', 'in:UYU,USD'],
            'image_url' => ['nullable', 'url:https', 'max:2048'],
            'published' => ['required', 'boolean'],
        ]);
        $item = DB::transaction(function () use ($request, $id, $data): InventoryItem {
            $item = InventoryItem::query()->whereIn('item_type', ['device', 'used_phone'])->whereKey($id)->lockForUpdate()->firstOrFail();
            $destination = $item->metadata['destination'] ?? null;
            if ($data['published']) {
                if ($destination !== 'Direct Sale'
                    || !$item->is_sellable || $item->stock_quantity < 1 || empty($data['price_minor'])
                    || in_array($item->operational_status, ['vendido', 'sold', 'descartado'], true)
                    || in_array($item->dismantling_status, ['partial', 'exhausted'], true)) {
                    throw ValidationException::withMessages(['publication' => 'El equipo debe estar destinado a venta directa, disponible, sin despiece y con precio válido.']);
                }
                if (DB::table('device_sale_records')->where('inventory_item_id', $id)->exists()) {
                    abort(409, 'No se puede publicar un equipo con ventas registradas.');
                }
            }

            $currentPrice = $item->sale_price_amount_minor !== null ? (int) $item->sale_price_amount_minor : null;
            $newPrice = isset($data['price_minor']) && $data['price_minor'] !== null ? (int) $data['price_minor'] : null;
            $priceChanged = $currentPrice !== $newPrice;

            if ($priceChanged) {
                if (in_array($item->operational_status, ['vendido', 'sold'], true)
                    || DB::table('device_sale_records')->where('inventory_item_id', $id)->exists()) {
                    abort(409, 'No se puede modificar el precio comercial de un equipo vendido o con venta registrada.');
                }
                if (DB::table('order_items')
                    ->join('orders', 'orders.id', '=', 'order_items.order_id')
                    ->where('order_items.inventory_item_id', $id)
                    ->whereIn('orders.status', ['pending', 'processing', 'ready'])
                    ->exists()) {
                    abort(409, 'No se puede modificar el precio comercial de un equipo reservado en un pedido comercial abierto.');
                }
            }

            $before = $this->summary($item);
            $item->fill([
                'title' => $data['title'], 'description' => $data['description'],
                'sale_price_amount_minor' => $data['price_minor'] ?? null,
                'currency_code' => $data['currency'],
                'main_image_url' => $data['image_url'] ?? null,
                'publication_status' => $data['published'] ? 'publicado' : 'no_publicable',
            ]);
            $item->save();
            DB::table('audit_events')->insert([
                'id' => (string) Str::ulid(), 'event_type' => 'inventory.phone_publication_updated',
                'action' => 'update', 'entity_type' => 'InventoryItem', 'entity_id' => $id,
                'actor_type' => 'user', 'actor_id' => (string) $request->user()->getAuthIdentifier(),
                'metadata' => json_encode(['before' => $before, 'after' => $this->summary($item)], JSON_THROW_ON_ERROR),
                'occurred_at' => now(),
            ]);
            return $item;
        });
        return response()->json(['data' => $this->summary($item)])->header('Cache-Control', 'no-store');
    }
}
