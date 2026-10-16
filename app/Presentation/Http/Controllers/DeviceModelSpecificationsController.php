<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\MasterData\DeviceModelReferenceGuard;
use App\Infrastructure\MasterData\DeviceModelSpec;
use App\Infrastructure\MasterData\DeviceModelVariant;
use App\Infrastructure\MasterData\MasterDataEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class DeviceModelSpecificationsController extends Controller
{
    public function show(string $modelId): JsonResponse
    {
        app(DeviceModelReferenceGuard::class)->assertKind($modelId, 'deviceModels', 'device_model_id');

        return response()->json(['data' => [
            'device_model_id' => $modelId,
            'specifications' => DeviceModelSpec::query()->where('device_model_id', $modelId)->first(),
            'variants' => DeviceModelVariant::query()->where('device_model_id', $modelId)->orderBy('name')->get(),
        ]]);
    }

    public function saveSpecs(Request $request, string $modelId): JsonResponse
    {
        $this->rejectUnexpected($request, ['specs_json', 'source_type', 'source_url', 'source_reference']);
        $data = $request->validate([
            'specs_json' => ['required', 'array'],
            'source_type' => ['required', Rule::in(['manual', 'devicespecsapi', 'other'])],
            'source_url' => ['nullable', 'url', 'max:2048'],
            'source_reference' => ['nullable', 'string', 'max:255'],
        ]);
        app(DeviceModelReferenceGuard::class)->assertKind($modelId, 'deviceModels', 'device_model_id');

        $saved = DB::transaction(function () use ($request, $modelId, $data): DeviceModelSpec {
            // Lock the parent row even on first insert, when no specification row exists yet.
            MasterDataEntry::query()->whereKey($modelId)->lockForUpdate()->firstOrFail();
            $spec = DeviceModelSpec::query()->where('device_model_id', $modelId)->lockForUpdate()->first();
            if (!$spec) {
                $spec = new DeviceModelSpec(['device_model_id' => $modelId]);
            }
            $before = $spec->exists ? $spec->only(['specs_json', 'source_type', 'source_url', 'source_reference', 'status']) : null;
            $spec->fill($data);
            $spec->status = 'draft';
            $spec->reviewed_at = null;
            $spec->reviewed_by = null;
            $spec->save();
            $this->audit($request, 'device_model.specifications_saved', $modelId, [
                'spec_id' => $spec->id,
                'before' => $before,
                'after' => $spec->only(['specs_json', 'source_type', 'source_url', 'source_reference', 'status']),
            ]);
            return $spec;
        });
        return response()->json(['data' => $saved], 200);
    }

    public function storeVariant(Request $request, string $modelId): JsonResponse
    {
        $data = $this->variantPayload($request);
        app(DeviceModelReferenceGuard::class)->assertKind($modelId, 'deviceModels', 'device_model_id');
        app(DeviceModelReferenceGuard::class)->assertCapacities($data['ram_capacity_id'] ?? null, $data['storage_capacity_id'] ?? null);
        $variant = DB::transaction(function () use ($request, $modelId, $data): DeviceModelVariant {
            $variant = DeviceModelVariant::query()->create([...$data, 'device_model_id' => $modelId]);
            $this->audit($request, 'device_model.variant_created', $modelId, ['variant_id' => $variant->id]);
            return $variant;
        });
        return response()->json(['data' => $variant], 201);
    }

    public function updateVariant(Request $request, string $modelId, string $variantId): JsonResponse
    {
        $data = $this->variantPayload($request);
        app(DeviceModelReferenceGuard::class)->assertKind($modelId, 'deviceModels', 'device_model_id');
        $variant = DB::transaction(function () use ($request, $modelId, $variantId, $data): DeviceModelVariant {
            $variant = DeviceModelVariant::query()->where('device_model_id', $modelId)->whereKey($variantId)->lockForUpdate()->firstOrFail();
            $before = $variant->only(array_keys($data));
            $variant->fill($data)->save();
            $this->audit($request, 'device_model.variant_updated', $modelId, [
                'variant_id' => $variantId,
                'before' => $before,
                'after' => $variant->only(array_keys($data)),
            ]);
            return $variant;
        });
        return response()->json(['data' => $variant]);
    }

    private function variantPayload(Request $request): array
    {
        $this->rejectUnexpected($request, ['name', 'variant_key', 'ram_capacity_id', 'storage_capacity_id', 'region_code', 'manufacturer_variant_code', 'differences_json', 'active']);
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'variant_key' => ['required', 'string', 'max:120', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'ram_capacity_id' => ['nullable', 'string', 'max:120'],
            'storage_capacity_id' => ['nullable', 'string', 'max:120'],
            'region_code' => ['nullable', 'string', 'max:40'],
            'manufacturer_variant_code' => ['nullable', 'string', 'max:120'],
            'differences_json' => ['nullable', 'array'],
            'active' => ['sometimes', 'boolean'],
        ]);
    }

    private function rejectUnexpected(Request $request, array $allowed): void
    {
        $unknown = array_diff(array_keys($request->all()), $allowed);
        if ($unknown !== []) {
            throw ValidationException::withMessages(['payload' => 'Campos no permitidos: '.implode(', ', $unknown)]);
        }
    }

    private function audit(Request $request, string $event, string $modelId, array $details): void
    {
        DB::table('audit_events')->insert([
            'id' => (string) \Illuminate\Support\Str::ulid(),
            'event_type' => $event,
            'action' => 'update',
            'entity_type' => 'DeviceModel',
            'entity_id' => $modelId,
            'actor_type' => 'user',
            'actor_id' => (string) $request->user()->getAuthIdentifier(),
            'correlation_id' => $request->attributes->get('correlation_id'),
            'metadata' => json_encode($details),
            'occurred_at' => now(),
        ]);
    }
}
