<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\Valuation\PublishedPartsDonor;
use App\Infrastructure\MasterData\MasterDataEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class OperationalInventoryController extends Controller
{
    public function index(): JsonResponse
    {
        $items = InventoryItem::query()->orderByDesc('created_at')->orderByDesc('id')->get();
        // Apply the same eligibility gates as the public product catalog.
        $storeIds = InventoryItem::query()
            ->where('publication_status', 'publicado')
            ->where('is_sellable', true)->where('stock_quantity', '>', 0)
            ->where('sale_price_amount_minor', '>', 0)
            ->where(function ($query): void {
                $query->whereIn('inventory_purpose', ['sell_as_used_phone', 'sell_as_spare_part'])
                    ->orWhere('metadata->destination', 'Direct Sale');
            })
            ->whereIn('operational_status', ['reparado', 'en_stock', 'disponible'])
            ->where(function ($query): void {
                $query->whereNull('metadata->origin')->orWhere('metadata->origin', '!=', 'recovered')
                    ->orWhere('metadata->part_condition', 'functional');
            })->pluck('id')->flip();
        $donorListings = PublishedPartsDonor::query()
            ->whereIn('inventory_item_id', $items->pluck('id'))
            ->get(['id', 'inventory_item_id'])->keyBy('inventory_item_id');
        return response()->json(['data' => $items->map(function (InventoryItem $item) use ($storeIds, $donorListings): array {
            $donor = $donorListings->get($item->id);
            $url = $storeIds->has($item->id) ? '/store/products/'.$item->id
                : ($donor ? '/store/for-parts/'.$donor->id : null);
            return [...$this->summary($item), 'store_visible' => $url !== null, 'store_url' => $url];
        })])->header('Cache-Control', 'private, no-store');
    }

    public function show(string $id): JsonResponse
    {
        $item = InventoryItem::query()->findOrFail($id);
        return response()->json(['data' => $this->summary($item)]);
    }

    /** Catalog edits are separate from physical stock and publication changes. */
    public function update(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:4000'],
            'brand' => ['sometimes', 'nullable', 'string', 'max:150'],
            'model' => ['sometimes', 'nullable', 'string', 'max:150'],
            'brand_id' => ['sometimes', 'required', 'string'],
            'device_model_id' => ['sometimes', 'required', 'string'],
            'consignor_id' => ['sometimes', 'nullable', 'string', \Illuminate\Validation\Rule::exists('consignors', 'id')],
        ]);
        if ($validated === []) {
            throw ValidationException::withMessages(['title' => 'Indicá al menos un campo para editar.']);
        }
        $item = DB::transaction(function () use ($request, $id, $validated): InventoryItem {
            $item = InventoryItem::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            if (DB::table('device_part_extractions')->where('donor_item_id', $id)->exists()) {
                abort(409, 'El donante con piezas extraídas conserva su identidad y titularidad.');
            }
            if ($item->component_identity_key !== null && array_intersect(array_keys($validated), ['brand', 'model', 'brand_id', 'device_model_id', 'consignor_id'])) {
                abort(409, 'El repuesto recuperado conserva su compatibilidad y propietario para mantener la trazabilidad.');
            }
            if ($item->item_type === 'spare_part'
                && (array_key_exists('brand', $validated) || array_key_exists('model', $validated))
                && (!array_key_exists('brand_id', $validated) || !array_key_exists('device_model_id', $validated))) {
                throw ValidationException::withMessages(['device_model_id' => 'Para editar la marca y el modelo de un repuesto, seleccioná ambos codificadores.']);
            }
            if (array_key_exists('brand_id', $validated) || array_key_exists('device_model_id', $validated)) {
                if ($item->item_type !== 'spare_part') {
                    throw ValidationException::withMessages(['brand_id' => 'Los codificadores de repuesto solo se editan en repuestos.']);
                }
                $brandId = $validated['brand_id'] ?? null;
                $modelId = $validated['device_model_id'] ?? null;
                $brandEntry = MasterDataEntry::query()->where('kind', 'brands')->whereKey($brandId)->first();
                $modelEntry = MasterDataEntry::query()->where('kind', 'deviceModels')->whereKey($modelId)->first();
                $brand = $brandEntry?->payload;
                $model = $modelEntry?->payload;
                if (!is_array($brand) || ($brand['active'] ?? false) !== true || !is_array($model) || ($model['active'] ?? false) !== true || ($model['brandId'] ?? null) !== $brandId) {
                    throw ValidationException::withMessages(['device_model_id' => 'Seleccioná una marca y un modelo activo correspondiente.']);
                }
                $validated['brand'] = $brand['name'];
                $validated['model'] = $model['name'];
                $metadata = is_array($item->metadata) ? $item->metadata : [];
                $metadata['brand_id'] = $brandId;
                $metadata['device_model_id'] = $modelId;
                $validated['metadata'] = $metadata;
                unset($validated['brand_id'], $validated['device_model_id']);
            }
            $previous = $item->only(array_keys($validated));
            $item->fill($validated);
            if ($item->isDirty()) {
                $item->save();
                $this->audit($request, $item->id, 'inventory.catalog_updated', [
                    'before' => $previous,
                    'after' => $item->only(array_keys($validated)),
                ]);
            }
            return $item;
        });
        return response()->json(['data' => $this->summary($item)]);
    }

    public function adjustments(string $id): JsonResponse
    {
        InventoryItem::query()->findOrFail($id);
        $history = DB::table('inventory_stock_adjustments')
            ->where('inventory_item_id', $id)
            ->orderByDesc('created_at')->orderByDesc('id')
            ->limit(50)
            ->get(['id', 'quantity_before', 'quantity_delta', 'quantity_after', 'reason', 'created_at']);

        return response()->json(['data' => $history]);
    }

    /** Stock mutations require a unique request ID and an auditable reason. */
    public function adjust(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'request_id' => ['required', 'uuid'],
            'delta' => ['required', 'integer', 'between:-100000,100000', 'not_in:0'],
            'reason' => ['required', 'string', 'min:10', 'max:300'],
        ]);

        $result = DB::transaction(function () use ($request, $id, $validated): array {
            $item = InventoryItem::query()->whereKey($id)->lockForUpdate()->firstOrFail();

            if (!in_array($item->item_type, ['spare_part', 'accessory', 'service_part'], true)) {
                throw ValidationException::withMessages([
                    'delta' => 'La cantidad de teléfonos físicos no se ajusta aquí: requiere movimientos individuales trazables.',
                ]);
            }

            $existing = DB::table('inventory_stock_adjustments')
                ->where('request_id', $validated['request_id'])->first();

            if ($existing !== null) {
                if ($existing->inventory_item_id !== $id
                    || (int) $existing->quantity_delta !== (int) $validated['delta']
                    || $existing->reason !== $validated['reason']) {
                    throw ValidationException::withMessages([
                        'request_id' => 'Esta solicitud ya se utilizó para una operación distinta.',
                    ]);
                }
                return ['item' => $item, 'replayed' => true];
            }

            $before = (int) $item->stock_quantity;
            $after = $before + (int) $validated['delta'];
            if ($after < 0 || $after > 2147483647) {
                throw ValidationException::withMessages([
                    'delta' => 'La cantidad resultante debe estar entre cero y el máximo admitido.',
                ]);
            }

            // Manual stock movements cannot consume quantities reserved by open
            // commercial orders. The inventory row lock serializes with order creation.
            $committed = (int) DB::table('order_items')
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->where('order_items.inventory_item_id', $item->id)
                ->whereIn('orders.status', ['pending', 'processing', 'ready'])
                ->sum('order_items.quantity');
            if ($after < $committed) {
                abort(409, 'El ajuste dejaría menos unidades que las comprometidas en pedidos abiertos.');
            }

            $item->stock_quantity = $after;
            $item->save();
            $adjustmentId = (string) Str::ulid();
            DB::table('inventory_stock_adjustments')->insert([
                'id' => $adjustmentId,
                'inventory_item_id' => $item->id,
                'request_id' => $validated['request_id'],
                'quantity_before' => $before,
                'quantity_delta' => $validated['delta'],
                'quantity_after' => $after,
                'reason' => $validated['reason'],
                'actor_id' => (string) $request->user()->getAuthIdentifier(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $this->audit($request, $item->id, 'inventory.stock_adjusted', [
                'stock_adjustment_id' => $adjustmentId,
                'before' => $before,
                'delta' => (int) $validated['delta'],
                'after' => $after,
                'reason' => $validated['reason'],
            ]);

            return ['item' => $item, 'replayed' => false];
        });

        return response()->json([
            'data' => $this->summary($result['item']),
            'replayed' => $result['replayed'],
        ]);
    }

    private function summary(InventoryItem $item): array
    {
        $rawPoint = $item->metadata['reorder_point'] ?? null;
        $point = is_int($rawPoint) && $rawPoint >= 0 ? $rawPoint : null;
        return [
            'id' => $item->id,
            'sku' => $item->sku,
            'title' => $item->title,
            'description' => $item->description,
            'item_type' => $item->item_type,
            'brand' => $item->brand,
            'model' => $item->model,
            'brand_id' => $item->metadata['brand_id'] ?? null,
            'device_model_id' => $item->metadata['device_model_id'] ?? null,
            'inventory_purpose' => $item->inventory_purpose,
            'operational_status' => $item->operational_status,
            'publication_status' => $item->publication_status,
            'consignor_id' => $item->consignor_id,
            'stock_quantity' => (int) $item->stock_quantity,
            'reorder_point' => $point,
            'updated_at' => $item->updated_at?->toIso8601String(),
        ];
    }

    private function audit(Request $request, string $id, string $event, array $changes): void
    {
        DB::table('audit_events')->insert([
            'id' => (string) Str::ulid(),
            'event_type' => $event,
            'action' => 'update',
            'entity_type' => 'InventoryItem',
            'entity_id' => $id,
            'actor_type' => 'user',
            'actor_id' => (string) $request->user()->getAuthIdentifier(),
            'correlation_id' => $request->attributes->get('correlation_id'),
            'metadata' => json_encode($changes),
            'occurred_at' => now(),
        ]);
    }
}
