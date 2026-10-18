<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\MasterData\DeviceModelReferenceGuard;
use App\Infrastructure\MasterData\DeviceModelVariant;
use App\Infrastructure\MasterData\DeviceSpecificationResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

/**
 * Read-only access to LOCAL specifications for operational screens (intake,
 * edit modal). Deliberately separate from the catalog admin controller so that
 * operators who cannot manage the catalog can still see inherited specs.
 */
final class DeviceSpecificationsReadController extends Controller
{
    public function forModel(Request $request, string $modelId, DeviceSpecificationResolver $resolver): JsonResponse
    {
        $values = $request->validate(['variant_id' => ['nullable', 'string', 'max:40']]);
        app(DeviceModelReferenceGuard::class)->assertKind($modelId, 'deviceModels', 'device_model_id');

        return response()->json(['data' => [
            // Only active variants are offered for NEW assignments; they stay optional.
            'variants' => DeviceModelVariant::query()->where('device_model_id', $modelId)->where('active', true)
                ->orderBy('name')->get(['id', 'name', 'variant_key'])->all(),
            'resolved' => $resolver->forModel($modelId, $values['variant_id'] ?? null),
        ]])->header('Cache-Control', 'private, no-store');
    }

    public function forDevice(string $id, DeviceSpecificationResolver $resolver): JsonResponse
    {
        $item = InventoryItem::query()->findOrFail($id);
        if (!in_array($item->item_type, ['device', 'used_phone'], true)) {
            abort(422, 'Las especificaciones heredadas solo aplican a dispositivos individuales.');
        }

        return response()->json(['data' => $resolver->forDevice($item)])
            ->header('Cache-Control', 'private, no-store');
    }
}
