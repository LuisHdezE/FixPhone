<?php

namespace App\Infrastructure\MasterData;

use App\Infrastructure\Inventory\InventoryItem;

/**
 * Read-only composition of what a unit "inherits" from the LOCAL catalog.
 *
 * Three strictly separated blocks:
 *  - inherited: model specs + (optional) variant differences, from FixPhone's DB only.
 *  - physical:  what was verified on this specific unit. Never overwritten by the catalog.
 *  - consistency: warnings when the unit contradicts its variant. Never auto-corrected.
 *
 * Nothing here is persisted onto inventory_items, and nothing calls an external API.
 */
final class DeviceSpecificationResolver
{
    /** @return array<string, mixed> */
    public function forModel(string $modelId, ?string $variantId = null): array
    {
        app(DeviceModelReferenceGuard::class)->assertKind($modelId, 'deviceModels', 'device_model_id');
        app(DeviceModelReferenceGuard::class)->assertVariantBelongsToModel($variantId, $modelId);

        $spec = DeviceModelSpec::query()->where('device_model_id', $modelId)->first();
        $modelSpecs = is_array($spec?->specs_json) ? $spec->specs_json : [];

        $variant = $variantId === null ? null : DeviceModelVariant::query()->find($variantId);
        $variantData = $variant === null ? null : [
            'id' => $variant->id,
            'name' => $variant->name,
            'variant_key' => $variant->variant_key,
            'active' => (bool) $variant->active,
            'ram' => $this->capacityLabel($variant->ram_capacity_id),
            'storage' => $this->capacityLabel($variant->storage_capacity_id),
            'region_code' => $variant->region_code,
            'manufacturer_variant_code' => $variant->manufacturer_variant_code,
            'differences' => is_array($variant->differences_json) ? $variant->differences_json : [],
        ];

        // Variant differences overlay the common sheet; unknown variant => model sheet only.
        $effective = $modelSpecs;
        if ($variantData !== null) {
            foreach ($variantData['differences'] as $key => $value) {
                if (is_string($key) && $value !== null && $value !== '') {
                    $effective[$key] = $value;
                }
            }
            foreach (['ram', 'storage'] as $key) {
                if ($variantData[$key] !== null) {
                    $effective[$key] = $variantData[$key];
                }
            }
        }

        return [
            'device_model_id' => $modelId,
            'variant_known' => $variantData !== null,
            'specifications_status' => $spec?->status,
            'specifications_source' => $spec?->source_type,
            'model_specs' => $modelSpecs,
            'variant' => $variantData,
            'effective' => $effective,
            'inherited_specs' => $modelSpecs,
            'effective_specs' => $effective,
        ];
    }

    /** @return array<string, mixed> */
    public function forDevice(InventoryItem $item): array
    {
        $meta = is_array($item->metadata) ? $item->metadata : [];
        $physical = [
            'serial_or_imei' => $meta['serial_or_imei'] ?? null,
            'ram_capacity_id' => $meta['ram_capacity_id'] ?? null,
            'ram' => $meta['ram'] ?? null,
            'storage_capacity_id' => $meta['storage_capacity_id'] ?? null,
            'storage' => $meta['storage'] ?? null,
            'color' => $meta['color'] ?? null,
            'condition_name' => $meta['condition_name'] ?? null,
            'physical_condition' => $meta['physical_condition'] ?? null,
            'powers_on' => $meta['powers_on'] ?? null,
            'account_lock' => $meta['account_lock'] ?? null,
        ];

        // Historical units without catalog FK: expose the legacy text, never guess a model from it.
        if ($item->device_model_id === null) {
            return [
                'identity_source' => 'legacy_text',
                'legacy' => ['brand' => $item->brand, 'model' => $item->model],
                'inherited' => null,
                'physical' => $physical,
                'consistency' => [],
            ];
        }

        $inherited = $this->forModel($item->device_model_id, $item->device_model_variant_id);

        $consistency = [];
        $variant = $inherited['variant'];
        if ($variant !== null) {
            $variantRamId = DeviceModelVariant::query()->whereKey($variant['id'])->value('ram_capacity_id');
            if ($variantRamId !== null && $physical['ram_capacity_id'] !== null
                && $variantRamId !== $physical['ram_capacity_id']) {
                $consistency[] = [
                    'field' => 'ram',
                    'message' => 'La RAM verificada en la unidad no coincide con la de su variante.',
                ];
            }
            $variantStorageId = DeviceModelVariant::query()->whereKey($variant['id'])->value('storage_capacity_id');
            if ($variantStorageId !== null && $physical['storage_capacity_id'] !== null
                && $variantStorageId !== $physical['storage_capacity_id']) {
                $consistency[] = [
                    'field' => 'storage',
                    'message' => 'El almacenamiento verificado en la unidad no coincide con el de su variante.',
                ];
            }
        }

        return [
            'identity_source' => 'catalog',
            'legacy' => ['brand' => $item->brand, 'model' => $item->model],
            'inherited' => $inherited,
            'physical' => $physical,
            'consistency' => $consistency,
        ];
    }

    private function capacityLabel(?string $id): ?string
    {
        if ($id === null) {
            return null;
        }
        $payload = MasterDataEntry::query()->whereKey($id)->first()?->payload;

        return is_array($payload) ? ($payload['label'] ?? $payload['name'] ?? null) : null;
    }
}
