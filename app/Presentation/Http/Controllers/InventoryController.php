<?php

namespace App\Presentation\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\Inventory\DeviceCodeAllocator;
use App\Infrastructure\Valuation\PublishedPartsDonor;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

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
                'public_listing_status' => ($publication || ($item->publication_status === 'publicado' && $item->inventory_purpose === 'sell_as_used_phone')) ? 'published' : 'draft',
                'phone_listing_status' => ($item->publication_status === 'publicado' && ($item->metadata['destination'] ?? null) === 'Direct Sale') ? 'published' : 'draft',
                'public_valuation_id' => $publication?->id,
            ];
        })])->header('Cache-Control', 'private, no-store, no-cache, must-revalidate');
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
            'ownership_type' => ['sometimes', 'required', 'in:owned,consignment'],
            'consignor_id' => ['nullable', 'string', Rule::exists('consignors', 'id')],
        ]);

        $consignedPurposes = ['consignation', 'consigned', 'consignacion', 'consigned_phone', 'sell_as_consigned'];
        $ownership = $validated['ownership_type'] ?? (in_array($validated['inventory_purpose'], $consignedPurposes, true) ? 'consignment' : 'owned');
        if ($ownership === 'consignment' && empty($validated['consignor_id'])) {
            throw ValidationException::withMessages(['consignor_id' => 'Seleccioná el consignante registrado.']);
        }
        if ($ownership === 'owned' && (!empty($validated['consignor_id']) || in_array($validated['inventory_purpose'], $consignedPurposes, true))) {
            throw ValidationException::withMessages(['ownership_type' => 'Un equipo propio no puede tener consignante ni destino de consignación.']);
        }
        if ($ownership === 'consignment') {
            if (!in_array($validated['item_type'], ['device', 'used_phone'], true)) {
                throw ValidationException::withMessages(['ownership_type' => 'La consignación está limitada al alta de dispositivos.']);
            }
            $validated['inventory_purpose'] = 'consignation';
        }
        $validated['consignor_id'] = $ownership === 'consignment' ? $validated['consignor_id'] : null;
        unset($validated['ownership_type']);

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
        $items = \App\Infrastructure\Inventory\StorefrontCatalog::query()->get();
        return response()->json($items->map(fn ($item) => [
            'id' => $item->id, 'title' => $item->title, 'description' => $item->description,
            'item_type' => $item->item_type, 'brand' => $item->brand, 'model' => $item->model,
            'operational_status' => $item->operational_status, 'stock_quantity' => $item->stock_quantity,
            'sale_price_amount_minor' => $item->sale_price_amount_minor, 'currency_code' => $item->currency_code,
            'main_image_url' => $item->main_image_url,
            'metadata' => ['origin' => $item->metadata['origin'] ?? null, 'part_condition' => $item->metadata['part_condition'] ?? null, 'reference_price_minor' => $item->metadata['reference_price_minor'] ?? null, 'reference_currency' => $item->metadata['reference_currency'] ?? null, 'is_original' => (bool) ($item->metadata['is_original'] ?? false)],
        ]));
    }
}
