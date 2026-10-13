<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Administrative catalog maintenance for physical devices only.
 * Sales, stock movement and publication are intentionally outside this CRUD.
 */
final class DeviceInventoryCrudController extends Controller
{
    private const EDITABLE = [
        'title', 'brand', 'model', 'description', 'serial_or_imei', 'storage',
        'color', 'physical_condition', 'powers_on', 'account_lock',
        'acquisition_source', 'cost_amount_minor', 'currency_code',
    ];

    public function update(Request $request, string $id): JsonResponse
    {
        $this->rejectUnexpectedFields($request);

        $values = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'brand' => ['nullable', 'string', 'max:150'],
            'model' => ['nullable', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:4000'],
            'serial_or_imei' => ['nullable', 'string', 'max:100'],
            'storage' => ['nullable', 'string', 'max:100'],
            'color' => ['nullable', 'string', 'max:100'],
            'physical_condition' => ['required', 'in:Excellent,Good,Fair,Poor,Damaged,Unknown'],
            'powers_on' => ['required', 'in:Yes,No,Unknown'],
            'account_lock' => ['required', 'in:Clear,Locked,Unknown'],
            'acquisition_source' => ['nullable', 'string', 'max:200'],
            'cost_amount_minor' => ['nullable', 'integer', 'min:0', 'max:2147483647'],
            'currency_code' => ['required', 'in:UYU,USD'],
        ]);

        $item = DB::transaction(function () use ($request, $id, $values): InventoryItem {
            $item = InventoryItem::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            $this->assertDevice($item);
            $this->assertNoFinancialHistory($item, 'editar');
            if ($item->publication_status === 'publicado') {
                abort(409, 'Primero despublicá el equipo para modificar su ficha.');
            }

            $before = $item->only(['title', 'brand', 'model', 'description', 'cost_amount_minor', 'currency_code', 'metadata']);
            $metadata = is_array($item->metadata) ? $item->metadata : [];
            // Avoid retaining obsolete master-data pointers when editing free-text device attributes.
            if (($item->brand ?? '') !== ($values['brand'] ?? '')) {
                $metadata['brand_id'] = null;
                $metadata['device_model_id'] = null;
            } elseif (($item->model ?? '') !== ($values['model'] ?? '')) {
                $metadata['device_model_id'] = null;
            }
            if (($metadata['storage'] ?? null) !== ($values['storage'] ?? null)) {
                $metadata['storage_capacity_id'] = null;
                $metadata['storage_capacity'] = null;
            }
            if (($metadata['color'] ?? null) !== ($values['color'] ?? null)) {
                $metadata['color_id'] = null;
            }
            if (($metadata['physical_condition'] ?? 'Unknown') !== $values['physical_condition']) {
                $metadata['condition_id'] = null;
                $metadata['condition_grade'] = null;
                $metadata['condition_name'] = null;
            }
            if (($metadata['serial_or_imei'] ?? null) !== ($values['serial_or_imei'] ?? null)) {
                $metadata['imei'] = null;
                $metadata['serial'] = null;
            }
            if (($metadata['acquisition_source'] ?? null) !== ($values['acquisition_source'] ?? null)) {
                $metadata['source'] = null;
            }
            foreach (['serial_or_imei', 'storage', 'color', 'physical_condition', 'powers_on', 'account_lock', 'acquisition_source'] as $key) {
                $metadata[$key] = $values[$key] ?? null;
            }

            $item->fill([
                'title' => $values['title'],
                'brand' => $values['brand'] ?? null,
                'model' => $values['model'] ?? null,
                'description' => $values['description'] ?? null,
                'cost_amount_minor' => $values['cost_amount_minor'] ?? null,
                'currency_code' => $values['currency_code'],
                'metadata' => $metadata,
            ]);
            if ($item->isDirty()) {
                $item->save();
                $this->audit($request, $item, 'inventory.device_updated', 'update', [
                    'before' => $before,
                    'after' => $item->only(array_keys($before)),
                ]);
            }
            return $item;
        });

        return response()->json(['data' => $item->fresh()]);
    }

    /** Logical deletion preserves immutable FXP codes and auditability. */
    public function destroy(Request $request, string $id): JsonResponse
    {
        DB::transaction(function () use ($request, $id): void {
            $item = InventoryItem::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            $this->assertDevice($item);
            $this->assertNoFinancialHistory($item, 'eliminar');

            if ($item->publication_status === 'publicado' || $item->is_sellable || $item->dismantling_status === 'partial' || $item->dismantling_status === 'exhausted') {
                abort(409, 'No se puede eliminar un equipo publicado, vendible o con despiece iniciado.');
            }

            $snapshot = $item->only([
                'sku', 'title', 'brand', 'model', 'item_type',
                'operational_status', 'inventory_purpose', 'stock_quantity',
                'cost_amount_minor', 'currency_code', 'metadata',
            ]);

            $item->delete();
            $this->audit($request, $item, 'inventory.device_archived', 'delete', ['snapshot' => $snapshot]);
        });

        return response()->json(['message' => 'Equipo retirado del inventario. Su código e historial se conservan.']);
    }

    private function rejectUnexpectedFields(Request $request): void
    {
        $unexpected = array_diff(array_keys($request->all()), self::EDITABLE);
        if ($unexpected !== []) {
            throw ValidationException::withMessages([
                'device' => 'La edición no permite modificar códigos, stock, publicación, destino ni campos fuera de la ficha: '.implode(', ', $unexpected),
            ]);
        }
    }

    private function assertDevice(InventoryItem $item): void
    {
        if (!in_array($item->item_type, ['device', 'used_phone'], true)) {
            abort(422, 'La operación está limitada a dispositivos individuales.');
        }
    }

    private function assertNoFinancialHistory(InventoryItem $item, string $verb): void
    {
        if (DB::table('device_sale_records')->where('inventory_item_id', $item->id)->exists()
            || DB::table('device_installed_parts')->where('inventory_item_id', $item->id)->exists()
            || DB::table('device_valuations')->where('inventory_item_id', $item->id)->exists()
            || DB::table('inventory_stock_adjustments')->where('inventory_item_id', $item->id)->exists()
            || in_array($item->operational_status, ['vendido', 'sold'], true)
        ) {
            abort(409, 'No se puede '.$verb.' un equipo con ventas, repuestos, tasaciones, ajustes o historial de venta. Conservá su trazabilidad.');
        }
    }

    private function audit(Request $request, InventoryItem $item, string $event, string $action, array $payload): void
    {
        DB::table('audit_events')->insert([
            'id' => (string) Str::ulid(),
            'event_type' => $event,
            'action' => $action,
            'entity_type' => 'InventoryItem',
            'entity_id' => $item->id,
            'actor_type' => 'user',
            'actor_id' => (string) $request->user()->getAuthIdentifier(),
            'correlation_id' => $request->attributes->get('correlation_id'),
            'metadata' => json_encode($payload),
            'occurred_at' => now(),
        ]);
    }
}
