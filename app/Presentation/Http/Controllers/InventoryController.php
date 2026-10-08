<?php

namespace App\Presentation\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InventoryController extends Controller
{
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
