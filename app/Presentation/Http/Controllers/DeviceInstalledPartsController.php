<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Inventory\DeviceInstalledPart;
use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class DeviceInstalledPartsController extends Controller
{
    public function index(string $id): JsonResponse
    {
        $device = InventoryItem::query()
            ->whereKey($id)
            ->whereIn('item_type', ['device', 'used_phone'])
            ->firstOrFail();

        $parts = DeviceInstalledPart::query()
            ->where('inventory_item_id', $id)
            ->orderByDesc('installed_at')
            ->orderByDesc('id')
            ->get();

        $activeParts = $parts->whereNull('voided_at');
        $totalCostMinor = (int) $activeParts->sum('cost_amount_minor');

        return response()->json([
            'data' => [
                'device' => [
                    'id' => $device->id,
                    'sku' => $device->sku,
                    'title' => $device->title,
                    'brand' => $device->brand,
                    'model' => $device->model,
                    'cost_amount_minor' => $device->cost_amount_minor,
                    'sale_price_amount_minor' => $device->sale_price_amount_minor,
                    'currency_code' => $device->currency_code,
                    'operational_status' => $device->operational_status,
                    'inventory_purpose' => $device->inventory_purpose,
                ],
                'installed_parts' => $parts->map(fn (DeviceInstalledPart $part) => $this->transformPart($part))->values()->all(),
                'total_installed_parts_cost_minor' => $totalCostMinor,
                'currency_code' => $device->currency_code ?? 'UYU',
            ],
        ]);
    }

    public function store(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'request_id' => ['required', 'uuid'],
            'part_name' => ['required', 'string', 'min:2', 'max:255'],
            'cost_amount_minor' => ['required', 'integer', 'between:0,100000000'],
            'spare_part_item_id' => ['nullable', 'string'],
            'currency_code' => ['sometimes', 'string', 'size:3'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'installed_at' => ['sometimes', 'nullable', 'date'],
        ]);

        $result = DB::transaction(function () use ($request, $id, $validated): array {
            $device = InventoryItem::query()
                ->whereKey($id)
                ->whereIn('item_type', ['device', 'used_phone'])
                ->lockForUpdate()
                ->firstOrFail();

            if (in_array($device->operational_status, ['vendido', 'sold'], true)) {
                throw ValidationException::withMessages([
                    'part_name' => 'No se pueden registrar nuevos repuestos instalados en un equipo que ya fue vendido y liquidado.',
                ]);
            }

            $currency = strtoupper($validated['currency_code'] ?? $device->currency_code ?? 'UYU');
            if ($currency !== strtoupper($device->currency_code ?? 'UYU')) {
                throw ValidationException::withMessages([
                    'currency_code' => 'La moneda del repuesto debe coincidir con la moneda del equipo.',
                ]);
            }

            $existing = DeviceInstalledPart::query()
                ->where('request_id', $validated['request_id'])
                ->first();

            if ($existing !== null) {
                if ($existing->inventory_item_id !== $id
                    || $existing->part_name !== $validated['part_name']
                    || (int) $existing->cost_amount_minor !== (int) $validated['cost_amount_minor']) {
                    throw ValidationException::withMessages([
                        'request_id' => 'Esta solicitud ya se utilizó para una operación distinta.',
                    ]);
                }
                return ['part' => $existing, 'replayed' => true];
            }

            $sparePartItem = null;
            if (!empty($validated['spare_part_item_id'])) {
                $sparePartItem = InventoryItem::query()
                    ->whereKey($validated['spare_part_item_id'])
                    ->lockForUpdate()
                    ->first();

                if ($sparePartItem === null) {
                    throw ValidationException::withMessages([
                        'spare_part_item_id' => 'El repuesto seleccionado no existe en el catálogo de inventario.',
                    ]);
                }

                if ((int) $sparePartItem->stock_quantity < 1) {
                    throw ValidationException::withMessages([
                        'spare_part_item_id' => 'El repuesto seleccionado no tiene existencias disponibles en inventario.',
                    ]);
                }

                $before = (int) $sparePartItem->stock_quantity;
                $after = $before - 1;
                $sparePartItem->stock_quantity = $after;
                $sparePartItem->save();

                $adjustmentId = (string) Str::ulid();
                DB::table('inventory_stock_adjustments')->insert([
                    'id' => $adjustmentId,
                    'inventory_item_id' => $sparePartItem->id,
                    'request_id' => (string) Str::uuid(),
                    'quantity_before' => $before,
                    'quantity_delta' => -1,
                    'quantity_after' => $after,
                    'reason' => 'Instalación de repuesto en equipo ' . ($device->sku ?? $device->id),
                    'actor_id' => (string) $request->user()->getAuthIdentifier(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $this->audit($request, $sparePartItem->id, 'InventoryItem', 'inventory.stock_adjusted', [
                    'stock_adjustment_id' => $adjustmentId,
                    'before' => $before,
                    'delta' => -1,
                    'after' => $after,
                    'reason' => 'Instalación de repuesto en equipo ' . ($device->sku ?? $device->id),
                ]);
            }

            $installedPart = DeviceInstalledPart::create([
                'id' => (string) Str::ulid(),
                'inventory_item_id' => $device->id,
                'spare_part_item_id' => $sparePartItem?->id,
                'part_name' => trim($validated['part_name']),
                'cost_amount_minor' => (int) $validated['cost_amount_minor'],
                'currency_code' => $currency,
                'installed_at' => !empty($validated['installed_at']) ? Carbon\Carbon::parse($validated['installed_at']) : now(),
                'installed_by_actor_id' => (string) $request->user()->getAuthIdentifier(),
                'notes' => $validated['notes'] ?? null,
                'request_id' => $validated['request_id'],
            ]);

            $this->audit($request, $installedPart->id, 'DeviceInstalledPart', 'device.part_installed', [
                'inventory_item_id' => $device->id,
                'part_name' => $installedPart->part_name,
                'cost_amount_minor' => $installedPart->cost_amount_minor,
                'spare_part_item_id' => $installedPart->spare_part_item_id,
            ]);

            return ['part' => $installedPart, 'replayed' => false];
        });

        return response()->json([
            'data' => $this->transformPart($result['part']),
            'replayed' => $result['replayed'],
        ], $result['replayed'] ? 200 : 201);
    }

    public function void(Request $request, string $id, string $partId): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:300'],
            'return_to_stock' => ['sometimes', 'boolean'],
        ]);

        $returnToStock = (bool) ($validated['return_to_stock'] ?? true);

        $part = DB::transaction(function () use ($request, $id, $partId, $validated, $returnToStock): DeviceInstalledPart {
            $device = InventoryItem::query()->whereKey($id)->firstOrFail();

            if (in_array($device->operational_status, ['vendido', 'sold'], true)) {
                throw ValidationException::withMessages([
                    'reason' => 'No se pueden anular repuestos instalados de un equipo que ya fue vendido y liquidado.',
                ]);
            }

            $part = DeviceInstalledPart::query()
                ->whereKey($partId)
                ->where('inventory_item_id', $device->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($part->voided_at !== null) {
                throw ValidationException::withMessages([
                    'reason' => 'Este registro de repuesto ya fue anulado previamente.',
                ]);
            }

            if ($returnToStock && !empty($part->spare_part_item_id)) {
                $sparePart = InventoryItem::query()
                    ->whereKey($part->spare_part_item_id)
                    ->lockForUpdate()
                    ->first();

                if ($sparePart !== null) {
                    $before = (int) $sparePart->stock_quantity;
                    $after = $before + 1;
                    $sparePart->stock_quantity = $after;
                    $sparePart->save();

                    $adjustmentId = (string) Str::ulid();
                    DB::table('inventory_stock_adjustments')->insert([
                        'id' => $adjustmentId,
                        'inventory_item_id' => $sparePart->id,
                        'request_id' => (string) Str::uuid(),
                        'quantity_before' => $before,
                        'quantity_delta' => 1,
                        'quantity_after' => $after,
                        'reason' => 'Anulación con devolución a inventario de equipo ' . ($device->sku ?? $device->id) . ': ' . $validated['reason'],
                        'actor_id' => (string) $request->user()->getAuthIdentifier(),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    $this->audit($request, $sparePart->id, 'InventoryItem', 'inventory.stock_adjusted', [
                        'stock_adjustment_id' => $adjustmentId,
                        'before' => $before,
                        'delta' => 1,
                        'after' => $after,
                        'reason' => 'Anulación de instalación en equipo ' . ($device->sku ?? $device->id),
                    ]);
                }
            }

            $part->voided_at = now();
            $part->voided_by_actor_id = (string) $request->user()->getAuthIdentifier();
            $part->void_reason = trim($validated['reason']) . ($returnToStock ? '' : ' (Sin devolución física a inventario)');
            $part->save();

            $this->audit($request, $part->id, 'DeviceInstalledPart', 'device.part_voided', [
                'inventory_item_id' => $device->id,
                'part_name' => $part->part_name,
                'cost_amount_minor' => $part->cost_amount_minor,
                'return_to_stock' => $returnToStock,
                'reason' => $part->void_reason,
            ]);

            return $part;
        });

        return response()->json([
            'data' => $this->transformPart($part),
        ]);
    }

    private function transformPart(DeviceInstalledPart $part): array
    {
        return [
            'id' => $part->id,
            'inventory_item_id' => $part->inventory_item_id,
            'spare_part_item_id' => $part->spare_part_item_id,
            'part_name' => $part->part_name,
            'cost_amount_minor' => (int) $part->cost_amount_minor,
            'currency_code' => $part->currency_code,
            'installed_at' => $part->installed_at?->toIso8601String(),
            'installed_by_actor_id' => $part->installed_by_actor_id,
            'notes' => $part->notes,
            'voided_at' => $part->voided_at?->toIso8601String(),
            'voided_by_actor_id' => $part->voided_by_actor_id,
            'void_reason' => $part->void_reason,
            'created_at' => $part->created_at?->toIso8601String(),
        ];
    }

    private function audit(Request $request, string $id, string $entityType, string $event, array $changes): void
    {
        DB::table('audit_events')->insert([
            'id' => (string) Str::ulid(),
            'event_type' => $event,
            'action' => 'update',
            'entity_type' => $entityType,
            'entity_id' => $id,
            'actor_type' => 'user',
            'actor_id' => (string) $request->user()->getAuthIdentifier(),
            'correlation_id' => $request->attributes->get('correlation_id'),
            'metadata' => json_encode($changes),
            'occurred_at' => now(),
        ]);
    }
}
