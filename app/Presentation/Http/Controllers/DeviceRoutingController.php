<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\Valuation\PublishedPartsDonor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Administrative routing of a physical device.
 * Status updates never record a sale, alter stock or change financial history.
 */
final class DeviceRoutingController extends Controller
{
    private const ROUTES = [
        'Pending Evaluation' => ['purpose' => 'internal_use', 'status' => 'ingresado'],
        'Donor' => ['purpose' => 'parts_donor', 'status' => 'para_deshuesar'],
        'Refurbish' => ['purpose' => 'repair_then_sell', 'status' => 'para_reparar'],
        'Hold' => ['purpose' => 'internal_use', 'status' => 'ingresado'],
        'Discard' => ['purpose' => 'discard', 'status' => 'descartado'],
    ];

    public function update(Request $request, string $id): JsonResponse
    {
        $values = $request->validate([
            'destination' => ['required', 'string', Rule::in(array_keys(self::ROUTES))],
            'reason' => ['required', 'string', 'min:10', 'max:500'],
        ]);
        if (array_diff(array_keys($request->all()), ['destination', 'reason'])) {
            throw ValidationException::withMessages(['destination' => 'La actualización de estado no admite otros campos.']);
        }

        $result = DB::transaction(function () use ($request, $id, $values): InventoryItem {
            $device = InventoryItem::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            if (!in_array($device->item_type, ['device', 'used_phone'], true)) {
                throw ValidationException::withMessages(['destination' => 'Solo se puede cambiar el destino de dispositivos individuales.']);
            }

            $metadata = is_array($device->metadata) ? $device->metadata : [];
            $oldDestination = $this->destination($metadata, $device->inventory_purpose);
            $next = $values['destination'];
            if ($oldDestination === $next) {
                throw ValidationException::withMessages(['destination' => 'El equipo ya tiene ese destino.']);
            }

            if (in_array($device->operational_status, ['vendido', 'sold'], true)
                || DB::table('device_sale_records')->where('inventory_item_id', $id)->exists()) {
                abort(409, 'El equipo tiene historial de ventas. Su destino no se cambia desde el enrutamiento.');
            }

            if (DB::table('order_items')->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->where('order_items.inventory_item_id', $id)
                ->whereIn('orders.status', ['pending', 'processing', 'ready'])->exists()) {
                abort(409, 'El equipo está comprometido en un pedido abierto. Resolvé el pedido antes de cambiar su destino.');
            }

            if ($device->is_sellable || $device->publication_status === 'publicado'
                || PublishedPartsDonor::query()->where('inventory_item_id', $id)->exists()) {
                abort(409, 'Primero deshabilitá la venta y retiralo de las publicaciones antes de cambiar su destino.');
            }

            if (in_array($device->dismantling_status, ['partial', 'exhausted'], true)) {
                abort(409, 'Un despiece iniciado o agotado no puede revertirse mediante un cambio de destino.');
            }

            if ($device->consignor_id !== null
                || in_array($device->inventory_purpose, ['consignation', 'consigned', 'consignacion', 'consigned_phone', 'sell_as_consigned'], true)) {
                abort(409, 'El equipo es de consignación. Requiere un procedimiento específico para preservar la titularidad.');
            }

            $before = [
                'destination' => $oldDestination,
                'inventory_purpose' => $device->inventory_purpose,
                'operational_status' => $device->operational_status,
            ];

            $route = self::ROUTES[$next];
            $metadata['destination'] = $next;
            $device->inventory_purpose = $route['purpose'];
            $device->operational_status = $route['status'];
            $device->metadata = $metadata;
            $device->save();

            DB::table('audit_events')->insert([
                'id' => (string) Str::ulid(),
                'event_type' => 'inventory.device_destination_changed',
                'action' => 'update',
                'entity_type' => 'InventoryItem',
                'entity_id' => $id,
                'actor_type' => 'user',
                'actor_id' => (string) $request->user()->getAuthIdentifier(),
                'correlation_id' => $request->attributes->get('correlation_id'),
                'metadata' => json_encode([
                    'before' => $before,
                    'after' => [
                        'destination' => $next,
                        'inventory_purpose' => $device->inventory_purpose,
                        'operational_status' => $device->operational_status,
                    ],
                    'reason' => trim($values['reason']),
                ]),
                'occurred_at' => now(),
            ]);

            return $device;
        });

        return response()->json(['data' => [
            'id' => $result->id,
            'sku' => $result->sku,
            'destination' => $result->metadata['destination'] ?? null,
            'inventory_purpose' => $result->inventory_purpose,
            'operational_status' => $result->operational_status,
        ]]);
    }

    private function destination(array $metadata, string $purpose): string
    {
        $explicit = $metadata['destination'] ?? null;
        if (is_string($explicit) && array_key_exists($explicit, self::ROUTES)) {
            return $explicit;
        }
        return match ($purpose) {
            'parts_donor', 'sell_as_spare_part' => 'Donor',
            'repair_then_sell', 'sell_as_used_phone' => 'Refurbish',
            'discard' => 'Discard',
            'internal_use', 'repair_for_customer' => 'Hold',
            default => 'Pending Evaluation',
        };
    }
}
