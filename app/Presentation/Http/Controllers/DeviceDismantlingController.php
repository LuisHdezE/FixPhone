<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\Valuation\DeviceValuation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class DeviceDismantlingController extends Controller
{
    /**
     * Records the observed dismantling state, not extracted-piece inventory.
     * Actual extraction and stock movements belong to the subsequent ledger phase.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'dismantling_status' => ['required', Rule::in(['not_started', 'partial', 'exhausted'])],
        ]);

        $item = DB::transaction(function () use ($request, $id, $validated): InventoryItem {
            $item = InventoryItem::query()->whereKey($id)->lockForUpdate()->firstOrFail();

            if (!in_array($item->item_type, ['device', 'used_phone'], true)
                || $item->inventory_purpose !== 'parts_donor') {
                throw ValidationException::withMessages([
                    'dismantling_status' => 'Solo los teléfonos destinados a repuestos admiten un estado de despiece.',
                ]);
            }

            $old = $item->dismantling_status ?? 'unknown';
            $next = $validated['dismantling_status'];
            if ($old === $next) {
                return $item;
            }

            $transitions = [
                'unknown' => ['not_started', 'partial', 'exhausted'],
                'not_started' => ['partial', 'exhausted'],
                'partial' => ['exhausted'],
                'exhausted' => [],
            ];

            if (!in_array($next, $transitions[$old] ?? [], true)) {
                throw ValidationException::withMessages([
                    'dismantling_status' => 'No se puede revertir un despiece registrado. Las correcciones requerirán un procedimiento auditable.',
                ]);
            }

            $item->dismantling_status = $next;
            $item->save();

            $actor = (string) $request->user()->getAuthIdentifier();
            $correlation = $request->attributes->get('correlation_id');
            $this->audit($item->id, 'INVENTORY.DISMANTLING_STATUS_CHANGED', 'InventoryItem', $actor, $correlation, [
                'previous' => $old,
                'current' => $next,
            ]);

            if (in_array($next, ['partial', 'exhausted'], true)) {
                // A previously advertised whole unit must not remain available.
                // Do not change quantity: extraction ledger does not exist yet.
                $valuations = DeviceValuation::query()
                    ->where('inventory_item_id', $item->id)
                    ->where('public_listing_status', 'published')
                    ->get();

                foreach ($valuations as $valuation) {
                    $valuation->public_listing_status = 'draft';
                    $valuation->save();
                    $this->audit($valuation->id, 'VALUATION.UNPUBLISHED_DUE_TO_DISMANTLING', 'DeviceValuation', $actor, $correlation, [
                        'inventory_item_id' => $item->id,
                        'dismantling_status' => $next,
                    ]);
                }
            }

            return $item;
        });

        return response()->json(['data' => $item]);
    }

    private function audit(string $entityId, string $eventType, string $entityType, string $actor, ?string $correlation, array $metadata): void
    {
        DB::table('audit_events')->insert([
            'id' => (string) Str::ulid(),
            'event_type' => $eventType,
            'action' => 'updated',
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'actor_type' => 'user',
            'actor_id' => $actor,
            'correlation_id' => $correlation,
            'metadata' => json_encode($metadata),
            'occurred_at' => now(),
        ]);
    }
}
