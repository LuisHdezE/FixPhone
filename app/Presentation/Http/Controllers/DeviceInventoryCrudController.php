<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\MasterData\DeviceModelReferenceGuard;
use App\Infrastructure\MasterData\MasterDataEntry;
use App\Infrastructure\Valuation\DeviceValuation;
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
        'brand_id', 'device_model_id', 'device_model_variant_id', 'storage_capacity_id', 'color_id', 'condition_id',
        'description', 'serial_or_imei', 'powers_on', 'account_lock',
        'acquisition_source', 'cost_amount_minor', 'currency_code',
        'ownership_type', 'consignor_id', 'ownership_correction_reason',
    ];

    /** Uses the same master catalog IDs as the device intake flow, never free-text brand/model. */
    public function update(Request $request, string $id): JsonResponse
    {
        $this->rejectUnexpectedFields($request);

        $values = $request->validate([
            'brand_id' => ['required', 'string'],
            'device_model_id' => ['required', 'string'],
            'device_model_variant_id' => ['nullable', 'string', 'max:40'],
            'storage_capacity_id' => ['nullable', 'string'],
            'color_id' => ['nullable', 'string'],
            'condition_id' => ['nullable', 'string'],
            'description' => ['nullable', 'string', 'max:4000'],
            'serial_or_imei' => ['nullable', 'string', 'max:100'],
            'powers_on' => ['required', 'in:Yes,No,Unknown'],
            'account_lock' => ['required', 'in:Clear,Locked,Unknown'],
            'acquisition_source' => ['nullable', 'string', 'max:200'],
            'cost_amount_minor' => ['nullable', 'integer', 'min:0', 'max:2147483647'],
            'currency_code' => ['required', 'in:UYU,USD'],
            'ownership_type' => ['sometimes', 'in:owned,consignment'],
            'consignor_id' => ['nullable', 'string', \Illuminate\Validation\Rule::exists('consignors', 'id')],
            'ownership_correction_reason' => ['nullable', 'string', 'max:500'],
        ]);

        $item = DB::transaction(function () use ($request, $id, $values): InventoryItem {
            $item = InventoryItem::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            $this->assertDevice($item);

            // Variant is optional. Omitted => keep it while the model is unchanged, otherwise clear it.
            $variantId = array_key_exists('device_model_variant_id', $values)
                ? ($values['device_model_variant_id'] ?: null)
                : ($item->device_model_id === $values['device_model_id'] ? $item->device_model_variant_id : null);

            // Detect actual changes compared to current state
            $currentBrandId = $item->metadata['brand_id'] ?? null;
            $brandChanged = $currentBrandId !== null
                ? ($values['brand_id'] !== $currentBrandId)
                : ($item->brand !== null && $item->brand !== $this->masterItem('brands', $values['brand_id'], 'brand_id')['name']);
            $modelChanged = $values['device_model_id'] !== $item->device_model_id;
            $variantChanged = $variantId !== $item->device_model_variant_id;
            $identityChanged = $brandChanged || $modelChanged || $variantChanged;

            $currentStorageId = $item->metadata['storage_capacity_id'] ?? null;
            $newStorageId = ($values['storage_capacity_id'] ?? null) ?: null;
            $storageChanged = array_key_exists('storage_capacity_id', $values) && $currentStorageId !== $newStorageId;

            $currentColorId = $item->metadata['color_id'] ?? null;
            $newColorId = ($values['color_id'] ?? null) ?: null;
            $colorChanged = array_key_exists('color_id', $values) && $currentColorId !== $newColorId;

            $currentConditionId = $item->metadata['condition_id'] ?? null;
            $newConditionId = ($values['condition_id'] ?? null) ?: null;
            $conditionChanged = array_key_exists('condition_id', $values) && $currentConditionId !== $newConditionId;

            $currentSerial = trim((string) ($item->metadata['serial_or_imei'] ?? $item->metadata['imei'] ?? $item->metadata['serial'] ?? ''));
            $newSerial = trim((string) ($values['serial_or_imei'] ?? ''));
            $serialChanged = array_key_exists('serial_or_imei', $values) && $currentSerial !== $newSerial;

            $currentPowersOn = $item->metadata['powers_on'] ?? null;
            $powersOnChanged = array_key_exists('powers_on', $values) && $currentPowersOn !== $values['powers_on'];

            $currentAccountLock = $item->metadata['account_lock'] ?? null;
            $accountLockChanged = array_key_exists('account_lock', $values) && $currentAccountLock !== $values['account_lock'];

            $currentDesc = trim((string) ($item->description ?? ''));
            $newDesc = trim((string) ($values['description'] ?? ''));
            $descChanged = array_key_exists('description', $values) && $currentDesc !== $newDesc;

            $currentCost = $item->cost_amount_minor !== null ? (int) $item->cost_amount_minor : null;
            $newCost = isset($values['cost_amount_minor']) && $values['cost_amount_minor'] !== null ? (int) $values['cost_amount_minor'] : null;
            $costChanged = array_key_exists('cost_amount_minor', $values) && $currentCost !== $newCost;

            $currentCurrency = (string) $item->currency_code;
            $currencyChanged = array_key_exists('currency_code', $values) && $currentCurrency !== (string) $values['currency_code'];

            $currentAcq = trim((string) ($item->metadata['acquisition_source'] ?? $item->metadata['source'] ?? ''));
            $newAcq = trim((string) ($values['acquisition_source'] ?? ''));
            $sourceChanged = array_key_exists('acquisition_source', $values) && $currentAcq !== $newAcq;

            $financialChanged = $costChanged || $currencyChanged || $sourceChanged;

            $ownershipRequested = array_key_exists('ownership_type', $values);
            $currentlyConsigned = $item->consignor_id !== null || in_array($item->inventory_purpose, ['consignation', 'consigned', 'consignacion', 'consigned_phone', 'sell_as_consigned'], true);
            $ownershipChanges = $ownershipRequested && ($currentlyConsigned !== ($values['ownership_type'] === 'consignment')
                || ($values['ownership_type'] === 'consignment' && $item->consignor_id !== ($values['consignor_id'] ?? null)));

            $hasChanges = $identityChanged
                || $storageChanged
                || $colorChanged
                || $conditionChanged
                || $serialChanged
                || $powersOnChanged
                || $accountLockChanged
                || $descChanged
                || $financialChanged
                || $ownershipChanges;

            if (!$hasChanges) {
                return $item;
            }

            // Specific guards when Identity changes
            if ($identityChanged) {
                if (in_array($item->operational_status, ['vendido', 'sold'], true)
                    || DB::table('device_sale_records')->where('inventory_item_id', $item->id)->exists()) {
                    abort(409, 'No se puede modificar la identidad de un equipo vendido o con venta registrada.');
                }
                if (DB::table('device_part_extractions')->where('donor_item_id', $item->id)->exists()
                    || in_array($item->dismantling_status, ['partial', 'exhausted'], true)) {
                    abort(409, 'No se puede modificar la identidad de un equipo con piezas extraídas o despiece iniciado.');
                }
                if (DB::table('order_items')
                    ->join('orders', 'orders.id', '=', 'order_items.order_id')
                    ->where('order_items.inventory_item_id', $item->id)
                    ->whereIn('orders.status', ['pending', 'processing', 'ready'])
                    ->exists()) {
                    abort(409, 'No se puede modificar la identidad de un equipo reservado en un pedido comercial abierto.');
                }
            }

            // Specific guards when Financial / Acquisition data changes
            if ($financialChanged) {
                if (in_array($item->operational_status, ['vendido', 'sold'], true)
                    || DB::table('device_sale_records')->where('inventory_item_id', $item->id)->exists()) {
                    abort(409, 'No se pueden modificar los datos financieros o de adquisición de un equipo vendido o con venta registrada.');
                }
                if (DB::table('order_items')
                    ->join('orders', 'orders.id', '=', 'order_items.order_id')
                    ->where('order_items.inventory_item_id', $item->id)
                    ->whereIn('orders.status', ['pending', 'processing', 'ready'])
                    ->exists()) {
                    abort(409, 'No se pueden modificar los datos financieros o de adquisición de un equipo reservado en un pedido comercial abierto.');
                }
                if (DB::table('device_part_extractions')->where('donor_item_id', $item->id)->exists()) {
                    abort(409, 'No se pueden modificar los datos de costo y adquisición de un equipo con piezas extraídas.');
                }
            }

            // Specific guards when Ownership changes
            if ($ownershipChanges) {
                if (mb_strlen(trim($values['ownership_correction_reason'] ?? '')) < 10) {
                    throw ValidationException::withMessages(['ownership_correction_reason' => 'Explicá la corrección de titularidad (mínimo 10 caracteres).']);
                }
                if ($values['ownership_type'] === 'consignment' && empty($values['consignor_id'])) {
                    throw ValidationException::withMessages(['consignor_id' => 'Seleccioná el consignante registrado.']);
                }
                if (DB::table('device_sale_records')->where('inventory_item_id', $id)->exists()
                    || DB::table('order_items')->join('orders', 'orders.id', '=', 'order_items.order_id')
                        ->where('order_items.inventory_item_id', $id)->exists()) {
                    abort(409, 'No se puede corregir titularidad con historial de ventas o pedidos.');
                }
                if (DB::table('device_part_extractions')->where('donor_item_id', $item->id)->exists()) {
                    abort(409, 'Un equipo con piezas extraídas conserva su identidad y titularidad.');
                }
            }

            $brand = $this->masterItem('brands', $values['brand_id'], 'brand_id');
            $model = $this->masterItem('deviceModels', $values['device_model_id'], 'device_model_id');
            if (($model['brandId'] ?? null) !== $values['brand_id']) {
                throw ValidationException::withMessages([
                    'device_model_id' => 'El modelo seleccionado no pertenece a la marca indicada.',
                ]);
            }
            $storage = $this->optionalMasterItem('storageCapacities', $values['storage_capacity_id'] ?? null, 'storage_capacity_id');

            app(DeviceModelReferenceGuard::class)->assertDeviceIdentity(
                $values['device_model_id'], $variantId, $values['brand_id'],
                requireActiveVariant: $variantId !== $item->device_model_variant_id,
            );
            $color = $this->optionalMasterItem('colors', $values['color_id'] ?? null, 'color_id');
            $condition = $this->optionalMasterItem('conditions', $values['condition_id'] ?? null, 'condition_id');

            $before = $item->only(['title', 'brand', 'model', 'description', 'cost_amount_minor', 'currency_code', 'inventory_purpose', 'consignor_id', 'device_model_id', 'device_model_variant_id', 'metadata']);
            $metadata = is_array($item->metadata) ? $item->metadata : [];
            $metadata['brand_id'] = $values['brand_id'];
            $metadata['device_model_id'] = $values['device_model_id'];
            $metadata['device_model_variant_id'] = $variantId;
            if ($storage !== null) {
                $metadata['storage_capacity_id'] = $values['storage_capacity_id'] ?? null;
                $metadata['storage'] = $storage['label'];
                $metadata['storage_capacity'] = null;
            }
            if ($color !== null) {
                $metadata['color_id'] = $values['color_id'] ?? null;
                $metadata['color'] = $color['name'];
            }
            if ($condition !== null) {
                $metadata['condition_id'] = $values['condition_id'] ?? null;
                $metadata['condition_name'] = $condition['name'];
                $metadata['condition_grade'] = $condition['grade'];
                $metadata['physical_condition'] = match ($condition['grade']) {
                    'N', 'OB' => 'Excellent',
                    'A' => 'Good',
                    'B' => 'Fair',
                    'PARTS' => 'Damaged',
                    default => 'Unknown',
                };
            }

            if (array_key_exists('serial_or_imei', $values)) {
                $metadata['serial_or_imei'] = $values['serial_or_imei'] ?: null;
                $metadata['imei'] = null;
                $metadata['serial'] = null;
            }
            if (array_key_exists('powers_on', $values)) {
                $metadata['powers_on'] = $values['powers_on'];
            }
            if (array_key_exists('account_lock', $values)) {
                $metadata['account_lock'] = $values['account_lock'];
            }
            if (array_key_exists('acquisition_source', $values)) {
                $metadata['acquisition_source'] = $values['acquisition_source'] ?: null;
                $metadata['source'] = null;
            }
            if (array_key_exists('description', $values)) {
                $metadata['notes'] = $values['description'] ?: null;
            }
            if ($ownershipChanges) {
                $item->consignor_id = $values['ownership_type'] === 'consignment' ? $values['consignor_id'] : null;
                $item->inventory_purpose = $values['ownership_type'] === 'consignment'
                    ? 'consignation'
                    : match ($metadata['destination'] ?? 'Pending Evaluation') {
                        'Donor' => 'parts_donor', 'Refurbish' => 'repair_then_sell',
                        'Discard' => 'discard', default => 'internal_use',
                    };
            }
            $item->fill([
                'title' => implode(' ', array_filter([$brand['name'], $model['name'], $metadata['storage'] ?? null])),
                'brand' => $brand['name'],
                'model' => $model['name'],
                'device_model_id' => $values['device_model_id'],
                'device_model_variant_id' => $variantId,
                'description' => array_key_exists('description', $values) ? ($values['description'] ?: null) : $item->description,
                'cost_amount_minor' => array_key_exists('cost_amount_minor', $values) ? $values['cost_amount_minor'] : $item->cost_amount_minor,
                'currency_code' => $values['currency_code'] ?? $item->currency_code,
                'metadata' => $metadata,
            ]);
            $item->save();

            if ($identityChanged) {
                $newModelName = trim($brand['name'].' '.$model['name']);
                DeviceValuation::query()->where('inventory_item_id', $item->id)
                    ->where('model_name', '!=', $newModelName)
                    ->update(['model_name' => $newModelName]);
            }

            $this->audit($request, $item, 'inventory.device_updated', 'update', [
                'before' => $before,
                'after' => $item->only(array_keys($before)),
                'ownership_correction_reason' => $ownershipChanges ? trim($values['ownership_correction_reason']) : null,
            ]);

            return $item;
        });

        return response()->json(['data' => $item->fresh()]);
    }

    private function masterItem(string $kind, string $id, string $field): array
    {
        $entry = MasterDataEntry::query()->where('kind', $kind)->whereKey($id)->first();
        $payload = $entry?->payload;
        if (!is_array($payload) || ($payload['active'] ?? false) !== true) {
            throw ValidationException::withMessages([$field => 'Seleccioná una opción activa del catálogo maestro.']);
        }
        return $payload;
    }

    private function optionalMasterItem(string $kind, ?string $id, string $field): ?array
    {
        return $id === null || $id === '' ? null : $this->masterItem($kind, $id, $field);
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

    private function assertNoFinancialHistory(InventoryItem $item, string $verb, bool $blockTechnicalEvaluations = true): void
    {
        if (DB::table('device_part_extractions')->where('donor_item_id', $item->id)->exists()) {
            abort(409, 'Un equipo con piezas extraídas conserva su identidad y titularidad.');
        }
        if ($blockTechnicalEvaluations && DB::table('device_technical_evaluations')->where('inventory_item_id', $item->id)->exists()) {
            abort(409, 'No se puede '.$verb.' un equipo con evaluaciones técnicas registradas. Conservá su identidad e historial.');
        }
        if (DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('order_items.inventory_item_id', $item->id)
            ->whereIn('orders.status', ['pending', 'processing', 'ready'])
            ->exists()) {
            abort(409, 'No se puede '.$verb.' un equipo reservado en un pedido comercial abierto.');
        }

        if (DB::table('device_sale_records')->where('inventory_item_id', $item->id)->exists()
            || DB::table('device_installed_parts')->where('inventory_item_id', $item->id)->exists()
            || ($blockTechnicalEvaluations && DB::table('device_valuations')->where('inventory_item_id', $item->id)->exists())
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
