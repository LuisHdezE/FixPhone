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

final class SparePartCompatibilityController extends Controller
{
    public function show(string $id): JsonResponse
    {
        $part = InventoryItem::query()->where('item_type', 'spare_part')->findOrFail($id);
        $ids = DB::table('inventory_part_model_compatibilities')
            ->where('inventory_item_id', $part->id)->orderBy('device_model_id')->pluck('device_model_id')->all();
        return response()->json(['data' => [
            'id' => $part->id, 'sku' => $part->sku, 'title' => $part->title,
            'device_model_ids' => $ids,
            'legacy_model_id' => $part->metadata['device_model_id'] ?? null,
            'locked_identity' => $part->component_identity_key !== null,
        ]])->header('Cache-Control', 'private, no-store');
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'device_model_ids' => ['required', 'array', 'min:1', 'max:50'],
            'device_model_ids.*' => ['required', 'string', 'distinct', 'max:255'],
            'reason' => ['required', 'string', 'min:10', 'max:300'],
        ]);
        $requested = array_values(array_unique($data['device_model_ids']));
        foreach ($requested as $modelId) {
            $entry = MasterDataEntry::query()->where('kind', 'deviceModels')->whereKey($modelId)->first();
            if (!is_array($entry?->payload) || ($entry->payload['active'] ?? false) !== true) {
                throw ValidationException::withMessages(['device_model_ids' => 'Todos los modelos deben existir y estar activos en el catálogo maestro.']);
            }
        }
        DB::transaction(function () use ($request, $id, $requested, $data): void {
            $part = InventoryItem::query()->where('item_type', 'spare_part')->whereKey($id)->lockForUpdate()->firstOrFail();
            $existing = DB::table('inventory_part_model_compatibilities')->where('inventory_item_id', $id)
                ->lockForUpdate()->pluck('device_model_id')->all();
            $before = array_values($existing);
            sort($before);
            $after = $requested;
            sort($after);
            if ($before === $after) return;

            // The original extraction identity must always remain compatible,
            // even if additional cross-model compatibilities are confirmed.
            $originalModel = $part->metadata['device_model_id'] ?? null;
            if ($part->component_identity_key !== null && $originalModel && !in_array($originalModel, $after, true)) {
                throw ValidationException::withMessages(['device_model_ids' => 'No se puede retirar el modelo de origen de un repuesto recuperado.']);
            }
            DB::table('inventory_part_model_compatibilities')->where('inventory_item_id', $id)
                ->whereNotIn('device_model_id', $after)->delete();
            foreach ($after as $modelId) {
                DB::table('inventory_part_model_compatibilities')->insertOrIgnore([
                    'id' => (string) Str::ulid(), 'inventory_item_id' => $id, 'device_model_id' => $modelId,
                    'source' => 'manual_review', 'created_at' => now(), 'updated_at' => now(),
                ]);
            }
            DB::table('audit_events')->insert([
                'id' => (string) Str::ulid(), 'event_type' => 'inventory.part_compatibility_updated',
                'action' => 'update', 'entity_type' => 'InventoryItem', 'entity_id' => $id,
                'actor_type' => 'user', 'actor_id' => (string) $request->user()->getAuthIdentifier(),
                'metadata' => json_encode(['before' => $before, 'after' => $after, 'reason' => trim($data['reason'])], JSON_THROW_ON_ERROR),
                'occurred_at' => now(),
            ]);
        });
        return $this->show($id);
    }
}
