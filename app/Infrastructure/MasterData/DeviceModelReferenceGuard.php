<?php

namespace App\Infrastructure\MasterData;

use Illuminate\Validation\ValidationException;

final class DeviceModelReferenceGuard
{
    public function assertKind(string $id, string $kind, string $field): void
    {
        if (!MasterDataEntry::query()->whereKey($id)->where('kind', $kind)->exists()) {
            throw ValidationException::withMessages([$field => 'La referencia no pertenece al tipo de catálogo esperado.']);
        }
    }

    public function assertVariantBelongsToModel(?string $variantId, ?string $modelId): void
    {
        if ($variantId === null) {
            return;
        }
        if ($modelId === null || !DeviceModelVariant::query()
            ->whereKey($variantId)->where('device_model_id', $modelId)->exists()) {
            throw ValidationException::withMessages(['device_model_variant_id' => 'La variante no pertenece al modelo seleccionado.']);
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
}
