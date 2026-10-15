<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\MasterData\MasterDataEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class SparePartsInventoryController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:180'],
            'brand_id' => ['required', 'string'],
            'device_model_id' => ['required', 'string'],
            'description' => ['nullable', 'string', 'max:4000'],
            'initial_stock' => ['required', 'integer', 'min:0', 'max:1000000'],
        ]);
        $brand = $this->catalog('brands', $data['brand_id'], 'brand_id');
        $model = $this->catalog('deviceModels', $data['device_model_id'], 'device_model_id');
        if (($model['brandId'] ?? null) !== $data['brand_id']) {
            throw ValidationException::withMessages([
                'device_model_id' => 'El modelo no pertenece a la marca seleccionada.',
            ]);
        }
        $item = DB::transaction(function () use ($request, $data, $brand, $model): InventoryItem {
            $item = InventoryItem::query()->create([
                'sku' => 'REP-'.strtoupper((string) Str::ulid()),
                'title' => trim($data['name']),
                'description' => $data['description'] ?? null,
                'item_type' => 'spare_part',
                'brand' => $brand['name'],
                'model' => $model['name'],
                'operational_status' => 'en_stock',
                'publication_status' => 'no_publicable',
                'inventory_purpose' => 'sell_as_spare_part',
                'is_sellable' => false,
                'stock_quantity' => $data['initial_stock'],
                'currency_code' => 'UYU',
                'metadata' => [
                    'brand_id' => $data['brand_id'],
                    'device_model_id' => $data['device_model_id'],
                ],
            ]);
            DB::table('audit_events')->insert([
                'id' => (string) Str::ulid(),
                'event_type' => 'inventory.spare_part_created',
                'action' => 'create',
                'entity_type' => 'InventoryItem',
                'entity_id' => $item->id,
                'actor_type' => 'user',
                'actor_id' => (string) $request->user()->getAuthIdentifier(),
                'correlation_id' => $request->attributes->get('correlation_id'),
                'metadata' => json_encode([
                    'sku' => $item->sku,
                    'brand_id' => $data['brand_id'],
                    'device_model_id' => $data['device_model_id'],
                    'initial_stock' => $data['initial_stock'],
                ]),
                'occurred_at' => now(),
            ]);
            return $item;
        });
        return response()->json(['data' => $item], 201);
    }

    private function catalog(string $kind, string $id, string $field): array
    {
        $entry = MasterDataEntry::query()->where('kind', $kind)->whereKey($id)->first();
        $value = $entry?->payload;
        if (!is_array($value) || ($value['active'] ?? false) !== true) {
            throw ValidationException::withMessages([$field => 'Seleccioná un valor activo del catálogo maestro.']);
        }
        return $value;
    }
}
