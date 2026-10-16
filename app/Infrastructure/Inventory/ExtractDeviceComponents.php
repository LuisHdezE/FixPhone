<?php
namespace App\Infrastructure\Inventory;

use App\Infrastructure\Inventory\ExtractedPartIdentity;
use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\Inventory\SparePartCodeAllocator;
use App\Infrastructure\MasterData\MasterDataEntry;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class ExtractDeviceComponents
{
    public function catalog(): array
    {
        return MasterDataEntry::query()->where('kind', 'sparePartTypes')->get()->mapWithKeys(fn ($entry) => [$entry->id => $entry->payload])->all();
    }

    public function assertDonor(InventoryItem $donor): void
    {
        $destination = $donor->metadata['destination'] ?? null;
        if (!in_array($donor->item_type, ['device', 'used_phone'], true)
            || ($destination !== 'Donor' && !($destination === null && $donor->inventory_purpose === 'parts_donor'))) {
            throw ValidationException::withMessages(['device' => 'Elegí un teléfono destinado a despiece.']);
        }
    }

    public function identity(InventoryItem $donor): array
    {
        $brandId = $donor->metadata['brand_id'] ?? '';
        $modelId = $donor->metadata['device_model_id'] ?? '';
        $brand = MasterDataEntry::query()->where('kind', 'brands')->whereKey($brandId)->first()?->payload;
        $model = MasterDataEntry::query()->where('kind', 'deviceModels')->whereKey($modelId)->first()?->payload;
        if (!is_array($brand) || !is_array($model) || ($brand['active'] ?? false) !== true || ($model['active'] ?? false) !== true || ($model['brandId'] ?? null) !== $brandId) {
            throw ValidationException::withMessages(['device' => 'Completá una marca y un modelo activos del catálogo en la ficha del donante.']);
        }
        return [$brand, $model];
    }

    private function ancestors(string $id, array $catalog): array
    {
        $path = [];
        while (isset($catalog[$id]) && !in_array($id, $path, true)) {
            $path[] = $id;
            $id = $catalog[$id]['parentId'] ?? '';
        }
        return $path;
    }

    public function conflicts(string $left, string $right, array $catalog): bool
    {
        $a = $this->ancestors($left, $catalog);
        $b = $this->ancestors($right, $catalog);
        return $left === $right || in_array($left, $b, true) || in_array($right, $a, true)
            || (in_array('part-display', $a, true) && in_array('part-display', $b, true))
            || (in_array('part-charge-port', $a, true) && in_array('part-charge-port', $b, true));
    }

    public function execute(string $id, array $data, string $actor): array
    {
        $components = array_map(fn ($row) => [
            'type_id' => $row['type_id'], 'condition' => $row['condition'],
            'variant' => trim(preg_replace('/\\s+/u', ' ', $row['variant'] ?? '')),
            'title' => trim($row['title'] ?? ''), 'description' => trim($row['description'] ?? ''),
            'sale_price_minor' => isset($row['sale_price_minor']) ? (int) $row['sale_price_minor'] : null,
            'image_url' => $row['image_url'] ?? null, 'publish' => (bool) ($row['publish'] ?? false),
        ], $data['components']);
        usort($components, fn ($a, $b) => strcmp($a['type_id'], $b['type_id']));
        $hash = hash('sha256', json_encode([$id, $data['currency'], $components], JSON_THROW_ON_ERROR));
        return DB::transaction(function () use ($id, $data, $components, $hash, $actor): array {
            // Serialize creation/matching across donors and manual spare-part creation.
            $sequence = DB::table('inventory_spare_part_sequences')->where('id', 1)->lockForUpdate()->first();
            abort_if(!$sequence, 409, 'El contador REP no está inicializado.');
            $previous = DB::table('device_extraction_batches')->where('request_id', $data['request_id'])->first();
            if ($previous) {
                abort_if($previous->request_hash !== $hash || $previous->actor_id !== $actor, 409, 'Esta solicitud ya se utilizó para otra extracción.');
                return [...json_decode($previous->result, true, 512, JSON_THROW_ON_ERROR), 'replayed' => true];
            }
            $donor = InventoryItem::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            $this->assertDonor($donor);
            abort_if($donor->dismantling_status === 'exhausted' || (int) $donor->stock_quantity !== 1
                || in_array($donor->operational_status, ['sold', 'vendido', 'descartado'], true), 409, 'El equipo no está disponible para extraer piezas.');
            abort_if(DB::table('device_sale_records')->where('inventory_item_id', $id)->exists(), 409, 'No se extraen piezas de un equipo con historial de ventas.');
            abort_if(DB::table('order_items')->join('orders', 'orders.id', '=', 'order_items.order_id')->where('inventory_item_id', $id)
                ->whereIn('orders.status', ['pending', 'processing', 'ready'])->exists(), 409, 'El donante está reservado en un pedido abierto.');
            [$brand, $model] = $this->identity($donor);
            $catalog = $this->catalog();
            $already = DB::table('device_part_extractions')->where('donor_item_id', $id)->pluck('part_type_id')->all();
            $seen = $already;
            foreach ($components as $row) {
                $type = $catalog[$row['type_id']] ?? null;
                if (!is_array($type) || ($type['active'] ?? false) !== true) {
                    throw ValidationException::withMessages(['components' => 'Seleccioná tipos de repuesto activos del catálogo.']);
                }
                foreach ($seen as $other) {
                    if ($this->conflicts($row['type_id'], $other, $catalog)) {
                        throw ValidationException::withMessages(['components' => 'El componente '.$type['name'].' ya fue extraído o se superpone con otro seleccionado.']);
                    }
                }
                $seen[] = $row['type_id'];
                if ($row['publish'] && $row['condition'] !== 'functional') {
                    throw ValidationException::withMessages(['components' => 'Para publicar cada pieza, indicá que es funcional y asigná un precio mayor que cero.']);
                }
            }

            $batchId = (string) Str::ulid();
            DB::table('device_extraction_batches')->insert([
                'id' => $batchId, 'request_id' => $data['request_id'], 'donor_item_id' => $id,
                'request_hash' => $hash, 'actor_id' => $actor, 'result' => '{}', 'created_at' => now(),
            ]);
            $result = [];
            foreach ($components as $row) {
                $type = $catalog[$row['type_id']];
                $key = ExtractedPartIdentity::key($brand['id'], $model['id'], $type['id'], $row['condition'], $donor->consignor_id, $data['currency'], $row['variant']);
                $spare = InventoryItem::query()->where('component_identity_key', $key)->lockForUpdate()->first();
                if (!$spare) {
                    // Adopt only an unambiguous compatible manual entry; never guess by similar names.
                    $matches = InventoryItem::query()->where('item_type', 'spare_part')->whereNull('component_identity_key')->lockForUpdate()->get()
                        ->filter(function ($item) use ($brand, $model, $type, $row, $donor, $data): bool {
                            $meta = $item->metadata ?? [];
                            return ($meta['origin'] ?? null) === 'recovered' && ($meta['brand_id'] ?? null) === $brand['id'] && ($meta['device_model_id'] ?? null) === $model['id']
                                && (($meta['spare_part_type_id'] ?? null) === $type['id'] || mb_strtolower(trim($item->title)) === mb_strtolower(trim($type['name'])))
                                && ExtractedPartIdentity::variant($meta['part_variant'] ?? '') === ExtractedPartIdentity::variant($row['variant'])
                                && ($meta['part_condition'] ?? 'untested') === $row['condition']
                                && $item->consignor_id === $donor->consignor_id && $item->currency_code === $data['currency'];
                        });
                    abort_if($matches->count() > 1, 409, 'Hay varios repuestos equivalentes. Unificá el catálogo antes de sumar existencias.');
                    $spare = $matches->first();
                }
                $created = $spare === null;
                if ($created) {
                    $title = $row['title'] ?: $type['name'].' · '.$brand['name'].' '.$model['name'].($row['variant'] ? ' · '.$row['variant'] : '').' · Recuperado';
                    $description = $row['description'] ?: 'Repuesto recuperado: '.$type['name'].'. Equipo de origen: '.$brand['name'].' '.$model['name'].'.'.($row['variant'] ? ' Variante: '.$row['variant'].'.' : '').' Consultá la condición indicada en esta ficha.';
                    if (mb_strlen($title) > 255) {
                        throw ValidationException::withMessages(['components' => 'Acortá el título del repuesto a 255 caracteres.']);
                    }
                    $spare = InventoryItem::query()->create([
                        'sku' => SparePartCodeAllocator::reserve(), 'title' => $title,
                        'description' => $description, 'item_type' => 'spare_part',
                        'brand' => $brand['name'], 'model' => $model['name'], 'consignor_id' => $donor->consignor_id,
                        'inventory_purpose' => 'sell_as_spare_part', 'operational_status' => 'en_stock',
                        'publication_status' => 'no_publicable', 'is_sellable' => false, 'stock_quantity' => 0,
                        'currency_code' => $data['currency'], 'cost_amount_minor' => null,
                    ]);
                }
                if ($row['sale_price_minor'] !== null && $spare->sale_price_amount_minor !== null && $spare->sale_price_amount_minor !== $row['sale_price_minor']) {
                    throw ValidationException::withMessages(['components' => 'El repuesto '.$spare->sku.' ya tiene otro precio. Dejá el precio vacío para conservarlo o actualizalo desde su publicación.']);
                }
                $before = (int) $spare->stock_quantity;
                abort_if($before < 0 || $before >= 2147483647, 409, 'Se alcanzó el máximo de existencias del repuesto.');
                $meta = $spare->metadata ?? [];
                $spare->forceFill([
                    'component_identity_key' => $key, 'stock_quantity' => $before + 1,
                    'sale_price_amount_minor' => $row['sale_price_minor'] ?? $spare->sale_price_amount_minor,
                    'main_image_url' => $spare->main_image_url ?: $row['image_url'],
                    'metadata' => [...$meta, 'brand_id' => $brand['id'], 'device_model_id' => $model['id'],
                        'spare_part_type_id' => $type['id'], 'part_variant' => $row['variant'], 'part_condition' => $row['condition'], 'origin' => 'recovered'],
                ]);
                if ($row['publish']) {
                    if (!$spare->sale_price_amount_minor || $spare->sale_price_amount_minor <= 0) {
                        throw ValidationException::withMessages(['components' => 'Para publicar cada pieza, asigná un precio mayor que cero.']);
                    }
                    $spare->publication_status = 'publicado';
                    $spare->is_sellable = true;
                }
                $spare->save();
                $extractionId = (string) Str::ulid();
                DB::table('device_part_extractions')->insert([
                    'id' => $extractionId, 'batch_id' => $batchId, 'donor_item_id' => $id, 'spare_item_id' => $spare->id,
                    'part_type_id' => $type['id'], 'part_name' => $type['name'], 'part_condition' => $row['condition'],
                    'quantity_before' => $before, 'quantity_after' => $before + 1,
                    'identity_snapshot' => json_encode(['donor_sku' => $donor->sku, 'brand_id' => $brand['id'], 'brand' => $brand['name'],
                        'model_id' => $model['id'], 'model' => $model['name'], 'variant' => $row['variant'],
                        'title' => $spare->title, 'description' => $spare->description, 'consignor_id' => $donor->consignor_id], JSON_THROW_ON_ERROR),
                    'created_at' => now(),
                ]);
                DB::table('inventory_stock_adjustments')->insert([
                    'id' => (string) Str::ulid(), 'inventory_item_id' => $spare->id, 'request_id' => (string) Str::uuid(),
                    'quantity_before' => $before, 'quantity_delta' => 1, 'quantity_after' => $before + 1,
                    'reason' => mb_substr('Despiece '.$donor->sku.': '.$type['name'], 0, 300), 'actor_id' => $actor,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
                $result[] = ['id' => $spare->id, 'sku' => $spare->sku, 'name' => $type['name'], 'created' => $created,
                    'quantity_before' => $before, 'quantity_after' => $before + 1, 'published' => $spare->publication_status === 'publicado'];
            }
            $donor->dismantling_status = 'partial';
            $donor->publication_status = 'no_publicable';
            $donor->is_sellable = false;
            $donor->save();
            DB::table('device_valuations')->where('inventory_item_id', $id)->update(['public_listing_status' => 'draft', 'updated_at' => now()]);
            $response = ['batch_id' => $batchId, 'donor_sku' => $donor->sku, 'items' => $result, 'replayed' => false];
            DB::table('device_extraction_batches')->where('id', $batchId)->update(['result' => json_encode($response, JSON_THROW_ON_ERROR)]);
            DB::table('audit_events')->insert([
                'id' => (string) Str::ulid(), 'event_type' => 'inventory.components_extracted', 'action' => 'extract',
                'entity_type' => 'InventoryItem', 'entity_id' => $id, 'actor_type' => 'user', 'actor_id' => $actor,
                'metadata' => json_encode($response, JSON_THROW_ON_ERROR), 'occurred_at' => now(),
            ]);
            return $response;
        });
    }
}
