<?php
namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Inventory\ExtractedPartIdentity;
use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class SparePartPublicationController extends Controller
{
    private function summary(InventoryItem $item): array
    {
        return ['id' => $item->id, 'sku' => $item->sku, 'title' => $item->title,
            'description' => $item->description, 'variant' => $item->metadata['part_variant'] ?? '',
            'condition' => $item->metadata['part_condition'] ?? 'untested',
            'price_minor' => $item->sale_price_amount_minor, 'currency' => $item->currency_code,
            'image_url' => $item->main_image_url, 'published' => $item->publication_status === 'publicado',
            'stock_quantity' => $item->stock_quantity];
    }

    public function show(string $id)
    {
        $item = InventoryItem::query()->where('item_type', 'spare_part')->findOrFail($id);
        return response()->json(['data' => $this->summary($item)])->header('Cache-Control', 'no-store');
    }

    public function update(Request $request, string $id)
    {
        $data = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'condition' => ['required', 'in:untested,functional,faulty'],
            'price_minor' => ['nullable', 'integer', 'min:1', 'max:2147483647'],
            'currency' => ['required', 'in:UYU,USD'], 'image_url' => ['nullable', 'url:https', 'max:2048'],
            'published' => ['required', 'boolean'],
        ]);
        $item = DB::transaction(function () use ($request, $id, $data): InventoryItem {
            DB::table('inventory_spare_part_sequences')->where('id', 1)->lockForUpdate()->first();
            $item = InventoryItem::query()->where('item_type', 'spare_part')->whereKey($id)->lockForUpdate()->firstOrFail();
            if ($data['published'] && ($data['condition'] !== 'functional' || empty($data['price_minor']) || $item->stock_quantity < 1)) {
                throw ValidationException::withMessages(['publication' => 'Para publicar, indicá estado funcional, precio mayor que cero y existencias disponibles.']);
            }
            $before = $this->summary($item);
            $meta = $item->metadata ?? [];
            if ($item->component_identity_key !== null) {
                $key = ExtractedPartIdentity::key($meta['brand_id'], $meta['device_model_id'], $meta['spare_part_type_id'], $data['condition'], $item->consignor_id, $data['currency'], $meta['part_variant'] ?? '');
                abort_if(DB::table('inventory_items')->where('component_identity_key', $key)->where('id', '!=', $id)->exists(), 409,
                    'Ya existe un repuesto con esta identidad y condición. Revisá las existencias antes de cambiarlo.');
                $item->forceFill(['component_identity_key' => $key]);
            }
            $meta['part_condition'] = $data['condition'];
            $item->fill(['title' => $data['title'] ?? $item->title, 'description' => array_key_exists('description', $data) ? $data['description'] : $item->description, 'metadata' => $meta, 'sale_price_amount_minor' => $data['price_minor'] ?? null,
                'currency_code' => $data['currency'], 'main_image_url' => $data['image_url'] ?? null,
                'publication_status' => $data['published'] ? 'publicado' : 'no_publicable',
                'is_sellable' => $data['published'], 'operational_status' => 'en_stock']);
            $item->save();
            DB::table('audit_events')->insert([
                'id' => (string) Str::ulid(), 'event_type' => 'inventory.spare_publication_updated', 'action' => 'publish',
                'entity_type' => 'InventoryItem', 'entity_id' => $id, 'actor_type' => 'user',
                'actor_id' => (string) $request->user()->getAuthIdentifier(),
                'metadata' => json_encode(['before' => $before, 'after' => $this->summary($item)], JSON_THROW_ON_ERROR), 'occurred_at' => now(),
            ]);
            return $item;
        });
        return response()->json(['data' => $this->summary($item)]);
    }
}
