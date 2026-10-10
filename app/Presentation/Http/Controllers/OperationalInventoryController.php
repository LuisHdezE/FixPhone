<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Inventory\InventoryItem;
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
        return response()->json(['data' => $items->map(fn (InventoryItem $item) => $this->summary($item))]);
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
            'consignor_id' => ['sometimes', 'nullable', 'string', \Illuminate\Validation\Rule::exists('consignors', 'id')],
        ]);
        if ($validated === []) {
            throw ValidationException::withMessages(['title' => 'Indicá al menos un campo para editar.']);
        }
        $item = DB::transaction(function () use ($request, $id, $validated): InventoryItem {
            $item = InventoryItem::query()->whereKey($id)->lockForUpdate()->firstOrFail();
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
