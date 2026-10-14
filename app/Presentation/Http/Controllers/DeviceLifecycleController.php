<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Explicit lifecycle transitions. Intake destination is historical; only
 * operational_status and the corresponding current purpose may evolve.
 */
final class DeviceLifecycleController extends Controller
{
    private const TRANSITIONS = [
        'ingresado' => ['en_evaluacion', 'en_espera', 'para_reparar', 'para_deshuesar', 'descartado'],
        'en_evaluacion' => ['en_espera', 'para_reparar', 'para_deshuesar', 'descartado'],
        'en_espera' => ['en_evaluacion', 'para_reparar', 'para_deshuesar', 'descartado'],
        'para_reparar' => ['en_reparacion', 'en_espera', 'para_deshuesar', 'descartado'],
        'en_reparacion' => ['reparado', 'en_espera', 'para_deshuesar'],
        'reparado' => ['listo_para_venta', 'en_reparacion', 'en_espera', 'para_deshuesar'],
        'listo_para_venta' => ['en_reparacion', 'en_espera', 'para_deshuesar'],
        'para_deshuesar' => ['para_reparar', 'en_espera', 'descartado'],
        'descartado' => ['en_evaluacion'],
        'en_stock' => ['en_espera', 'para_reparar', 'para_deshuesar'],
    ];

    private const CONSIGNMENT_PURPOSES = ['consigned_phone', 'consignation', 'consigned', 'consignacion', 'sell_as_consigned'];

    public function show(string $id): JsonResponse
    {
        $item = $this->device($id);
        $events = DB::table('audit_events')
            ->where('entity_type', 'InventoryItem')
            ->where('entity_id', $item->id)
            ->where('event_type', 'inventory.device_status_changed')
            ->orderByDesc('occurred_at')->orderByDesc('id')
            ->limit(100)->get(['id', 'actor_id', 'occurred_at', 'metadata']);

        return response()->json(['data' => [
            'id' => $item->id,
            'sku' => $item->sku,
            'initial_destination' => $item->metadata['destination'] ?? null,
            'operational_status' => $item->operational_status,
            'inventory_purpose' => $item->inventory_purpose,
            'allowed_statuses' => $this->available($item),
            'history' => $events->map(static function (object $event): array {
                $meta = json_decode($event->metadata ?? '{}', true);
                return [
                    'id' => $event->id,
                    'occurred_at' => $event->occurred_at,
                    'actor_id' => $event->actor_id,
                    'from_status' => $meta['from_status'] ?? null,
                    'to_status' => $meta['to_status'] ?? null,
                    'reason' => $meta['reason'] ?? null,
                    'from_purpose' => $meta['from_purpose'] ?? null,
                    'to_purpose' => $meta['to_purpose'] ?? null,
                ];
            })->values()->all(),
        ]]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if (array_diff(array_keys($request->all()), ['status', 'reason'])) {
            return response()->json(['errors' => ['status' => ['No se permite cambiar el destino inicial, stock, venta ni publicación desde esta operación.']]], 422);
        }
        $values = $request->validate([
            'status' => ['required', 'string', Rule::in(array_keys(self::TRANSITIONS))],
            'reason' => ['required', 'string', 'min:10', 'max:500'],
        ]);

        $result = DB::transaction(function () use ($request, $id, $values): InventoryItem {
            $item = InventoryItem::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            $this->assertDevice($item);
            $next = $values['status'];
            if (!in_array($next, $this->available($item), true)) {
                abort(409, 'La transición no está permitida para el estado actual o existen operaciones que la bloquean.');
            }

            $previousStatus = $item->operational_status;
            $previousPurpose = $item->inventory_purpose;
            $nextPurpose = $this->purposeFor($item, $next);
            $item->operational_status = $next;
            $item->inventory_purpose = $nextPurpose;
            // Never touch metadata.destination, SKU, stock or commercial flags.
            $item->save();

            DB::table('audit_events')->insert([
                'id' => (string) Str::ulid(),
                'event_type' => 'inventory.device_status_changed',
                'action' => 'update',
                'entity_type' => 'InventoryItem',
                'entity_id' => $item->id,
                'actor_type' => 'user',
                'actor_id' => (string) $request->user()->getAuthIdentifier(),
                'correlation_id' => $request->attributes->get('correlation_id'),
                'metadata' => json_encode([
                    'from_status' => $previousStatus,
                    'to_status' => $next,
                    'from_purpose' => $previousPurpose,
                    'to_purpose' => $nextPurpose,
                    'reason' => trim($values['reason']),
                ]),
                'occurred_at' => now(),
            ]);

            return $item;
        });

        return response()->json(['data' => [
            'id' => $result->id,
            'operational_status' => $result->operational_status,
            'inventory_purpose' => $result->inventory_purpose,
        ]]);
    }

    private function available(InventoryItem $item): array
    {
        $next = self::TRANSITIONS[$item->operational_status] ?? [];
        if ($next === []) return [];

        if ($item->is_sellable || in_array($item->publication_status, ['publicado', 'published'], true)
            || in_array($item->operational_status, ['vendido', 'sold'], true)
            || (int) $item->stock_quantity !== 1
            || DB::table('device_sale_records')->where('inventory_item_id', $item->id)->whereNull('voided_at')->exists()
            || DB::table('order_items')->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->where('order_items.inventory_item_id', $item->id)
                ->whereIn('orders.status', ['pending', 'processing', 'ready'])->exists()
            || DB::table('device_valuations')->where('inventory_item_id', $item->id)
                ->where('public_listing_status', 'published')->exists()) {
            return [];
        }

        if (in_array($item->dismantling_status, ['partial', 'exhausted'], true)) return [];

        // The consignor's ownership cannot be converted into donor/discard
        // stock through a simple lifecycle action.
        if (in_array($item->inventory_purpose, self::CONSIGNMENT_PURPOSES, true)) {
            $next = array_values(array_diff($next, ['para_deshuesar', 'descartado']));
        }

        // "Ready" is an operational milestone, not authorization to sell.
        if (($item->metadata['powers_on'] ?? null) !== 'Yes'
            || ($item->metadata['account_lock'] ?? null) !== 'Clear') {
            $next = array_values(array_diff($next, ['listo_para_venta']));
        }

        return $next;
    }

    private function purposeFor(InventoryItem $item, string $status): string
    {
        if (in_array($item->inventory_purpose, self::CONSIGNMENT_PURPOSES, true)) {
            return $item->inventory_purpose;
        }
        if ($status === 'para_deshuesar') return 'parts_donor';
        if ($status === 'descartado') return 'discard';
        if (in_array($status, ['para_reparar', 'en_reparacion', 'reparado', 'listo_para_venta'], true)) {
            return $item->inventory_purpose === 'sell_as_used_phone' ? 'sell_as_used_phone' : 'repair_then_sell';
        }
        if ($status === 'en_stock') return 'sell_as_used_phone';
        return 'internal_use';
    }

    private function device(string $id): InventoryItem
    {
        $item = InventoryItem::query()->findOrFail($id);
        $this->assertDevice($item);
        return $item;
    }

    private function assertDevice(InventoryItem $item): void
    {
        if (!in_array($item->item_type, ['device', 'used_phone'], true)) {
            abort(422, 'La gestión de estados solo se aplica a teléfonos individuales.');
        }
    }
}
