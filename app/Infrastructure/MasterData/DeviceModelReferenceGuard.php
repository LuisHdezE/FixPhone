<?php

namespace App\Infrastructure\MasterData;

use Illuminate\Validation\ValidationException;

/**
 * Single authority for model / variant / brand relationship rules.
 *
 * Every write path (Eloquent hooks, CRUD, quick intake, catalog admin) must go
 * through these methods so that a rule can never be enforced in one entry point
 * and forgotten in another.
 */
final class DeviceModelReferenceGuard
{
    public function assertKind(?string $id, string $kind, string $field): void
    {
        if ($id === null || trim($id) === '' || !MasterDataEntry::query()->whereKey($id)->where('kind', $kind)->exists()) {
            throw ValidationException::withMessages([$field => 'La referencia no pertenece al tipo de catálogo esperado.']);
        }
    }

    /**
     * @param bool $requireActive Only for NEW assignments: units that already
     *        reference a variant later retired from the catalog stay editable.
     */
    public function assertVariantBelongsToModel(?string $variantId, ?string $modelId, bool $requireActive = false): void
    {
        if ($variantId === null) {
            return;
        }
        $variant = $modelId === null ? null : DeviceModelVariant::query()
            ->whereKey($variantId)->where('device_model_id', $modelId)->first();
        if ($variant === null) {
            throw ValidationException::withMessages(['device_model_variant_id' => 'La variante no pertenece al modelo seleccionado.']);
        }
        if ($requireActive && !$variant->active) {
            throw ValidationException::withMessages(['device_model_variant_id' => 'La variante seleccionada está inactiva en el catálogo.']);
        }
    }

    public function assertCapacities(?string $ramId, ?string $storageId): void
    {
        if ($ramId !== null) {
            $this->assertKind($ramId, 'ramCapacities', 'ram_capacity_id');
        }
        if ($storageId !== null) {
            $this->assertKind($storageId, 'storageCapacities', 'storage_capacity_id');
        }
    }

    /** The model must belong to the selected brand (catalog payload `brandId`). */
    public function assertModelBelongsToBrand(string $modelId, string $brandId, string $field = 'device_model_id'): void
    {
        $payload = MasterDataEntry::query()->whereKey($modelId)->where('kind', 'deviceModels')->first()?->payload;
        if (!is_array($payload) || ($payload['brandId'] ?? null) !== $brandId) {
            throw ValidationException::withMessages([$field => 'El modelo seleccionado no pertenece a la marca indicada.']);
        }
    }

    /**
     * Full identity check for a physical unit. The variant is optional, but a
     * variant can never exist without its own model.
     */
    public function assertDeviceIdentity(?string $modelId, ?string $variantId, ?string $brandId = null, bool $requireActiveVariant = false): void
    {
        if ($modelId === null && $variantId === null) {
            return;
        }
        $this->assertKind($modelId, 'deviceModels', 'device_model_id');
        if ($brandId !== null) {
            $this->assertModelBelongsToBrand($modelId, $brandId);
        }
        $this->assertVariantBelongsToModel($variantId, $modelId, $requireActiveVariant);
    }

    /** Variants and media can only be removed once nothing points at them. */
    public function assertVariantUnreferenced(string $variantId): void
    {
        if (DeviceModelMedia::query()->where('device_model_variant_id', $variantId)->exists()) {
            throw ValidationException::withMessages(['variant' => 'La variante tiene imágenes asociadas. Retirá primero sus imágenes mediante el proceso de eliminación seguro.']);
        }
        if (\Illuminate\Support\Facades\DB::table('inventory_items')->where('device_model_variant_id', $variantId)->exists()) {
            throw ValidationException::withMessages(['variant' => 'La variante está asignada a equipos de inventario. Desactivala en lugar de eliminarla.']);
        }
    }
}
