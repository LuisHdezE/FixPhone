<?php

namespace App\Presentation\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\Inventory\DeviceCodeAllocator;
use App\Infrastructure\Valuation\PublishedPartsDonor;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InventoryController extends Controller
{
    public function devicesList()
    {
        $items = InventoryItem::query()
            ->whereIn('item_type', ['used_phone', 'device'])
            ->latest('created_at')
            ->get();

        // Present only actually accessible public listings, never infer visibility
        // from inventory flags or a stale valuation publication status.
        $visible = PublishedPartsDonor::query()
            ->whereIn('inventory_item_id', $items->pluck('id'))
            ->get(['id', 'inventory_item_id'])
            ->keyBy('inventory_item_id');

        return response()->json(['data' => $items->map(function (InventoryItem $item) use ($visible): array {
            $publication = $visible->get($item->id);
            return [
                ...$item->toArray(),
                'public_listing_status' => $publication ? 'published' : 'draft',
                'public_valuation_id' => $publication?->id,
            ];
        })]);
    }

    public function create(Request $request)
    {
        $validated = $request->validate([
            'sku' => 'nullable|string|unique:inventory_items',
            'title' => 'required|string',
            'description' => 'nullable|string',
            'item_type' => 'required|string',
            'brand' => 'nullable|string',
            'model' => 'nullable|string',
            'operational_status' => 'required|string',
            'publication_status' => 'required|string',
            'inventory_purpose' => 'required|string',
            'is_sellable' => 'boolean',
            'stock_quantity' => 'integer',
            'cost_amount_minor' => 'nullable|integer',
            'sale_price_amount_minor' => 'nullable|integer',
            'currency_code' => 'string',
            'main_image_url' => 'nullable|string',
            'social_publish_status' => 'nullable|string',
            'auto_publish_to_social' => 'boolean',
            'metadata' => 'nullable|array',
        ]);

        $item = DB::transaction(function () use ($validated, $request) {
            // New physical devices receive an immutable human-readable reference.
            // Imported items with a pre-existing SKU remain backward compatible.
            if (in_array($validated['item_type'], ['device', 'used_phone'], true)
                && empty($validated['sku'])) {
                $validated['sku'] = DeviceCodeAllocator::reserve();
            }

            if (in_array($validated['item_type'], ['device', 'used_phone'], true)) {
                // Existing imported devices are deliberately left as unknown.
                $validated['dismantling_status'] = 'not_started';
            }
            $item = InventoryItem::create($validated);

            DB::table('audit_events')->insert([
                'id' => (string) Str::ulid(),
                'event_type' => 'inventory.item_created',
                'action' => 'create',
                'entity_type' => 'InventoryItem',
                'entity_id' => $item->id,
                'actor_type' => 'system',
                'actor_id' => 'mvp_admin',
                'metadata' => json_encode(['payload' => $validated]),
                'occurred_at' => now(),
            ]);

            return $item;
        });

        return response()->json($item, 201);
    }

    public function showroomList()
    {
        $items = InventoryItem::where('publication_status', 'publicado')
            ->where('is_sellable', true)
            ->where('stock_quantity', '>', 0)
            ->whereNotNull('sale_price_amount_minor')
            ->whereIn('inventory_purpose', ['sell_as_used_phone', 'sell_as_spare_part'])
            ->whereIn('operational_status', ['reparado', 'en_stock'])
            ->get();

        return response()->json($items);
    }
}
