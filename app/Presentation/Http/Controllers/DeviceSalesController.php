<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Inventory\DeviceInstalledPart;
use App\Infrastructure\Inventory\DeviceSaleRecord;
use App\Infrastructure\Inventory\InventoryItem;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class DeviceSalesController extends Controller
{
    public function index(string $id): JsonResponse
    {
        $device = InventoryItem::query()
            ->whereKey($id)
            ->whereIn('item_type', ['device', 'used_phone'])
            ->firstOrFail();

        $sales = DeviceSaleRecord::query()
            ->where('inventory_item_id', $device->id)
            ->orderByDesc('sold_at')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'data' => [
                'device_id' => $device->id,
                'sku' => $device->sku,
                'title' => $device->title,
                'operational_status' => $device->operational_status,
                'sales' => $sales->map(fn (DeviceSaleRecord $sale) => $this->transformSale($sale))->values()->all(),
            ],
        ]);
    }

    public function store(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'request_id' => ['required', 'uuid'],
            'effective_sale_price_minor' => ['required', 'integer', 'between:0,100000000000'],
            'receipt_number' => ['nullable', 'string', 'max:100'],
            'consignor_id' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'sold_at' => ['sometimes', 'nullable', 'date'],
        ]);

        $result = DB::transaction(function () use ($request, $id, $validated): array {
            $device = InventoryItem::query()
                ->whereKey($id)
                ->whereIn('item_type', ['device', 'used_phone'])
                ->lockForUpdate()
                ->firstOrFail();

            $existing = DeviceSaleRecord::query()
                ->where('request_id', $validated['request_id'])
                ->first();

            if ($existing !== null) {
                if ($existing->inventory_item_id !== $id
                    || (int) $existing->effective_sale_price_minor !== (int) $validated['effective_sale_price_minor']) {
                    throw ValidationException::withMessages([
                        'request_id' => 'Esta solicitud ya se utilizó para una operación distinta.',
                    ]);
                }
                return ['sale' => $existing, 'replayed' => true];
            }

            $activeSale = DeviceSaleRecord::query()
                ->where('inventory_item_id', $device->id)
                ->whereNull('voided_at')
                ->first();

            if (in_array($device->operational_status, ['vendido', 'sold'], true) || $activeSale !== null) {
                throw ValidationException::withMessages([
                    'effective_sale_price_minor' => 'El equipo ya posee una venta registrada activa. No se puede vender nuevamente.',
                ]);
            }

            if (in_array($device->inventory_purpose, ['consignation', 'consigned', 'consignacion', 'consigned_phone', 'sell_as_consigned'], true) && empty($validated['consignor_id'])) {
                throw ValidationException::withMessages([
                    'consignor_id' => 'El equipo en consignación requiere identificar al consignante.',
                ]);
            }

            $installedPartsCostMinor = (int) DeviceInstalledPart::query()
                ->where('inventory_item_id', $device->id)
                ->whereNull('voided_at')
                ->sum('cost_amount_minor');

            $soldAt = !empty($validated['sold_at']) ? Carbon::parse($validated['sold_at']) : now();

            $saleRecord = DeviceSaleRecord::create([
                'id' => (string) Str::ulid(),
                'inventory_item_id' => $device->id,
                'effective_sale_price_minor' => (int) $validated['effective_sale_price_minor'],
                'initial_cost_amount_minor' => $device->cost_amount_minor !== null ? (int) $device->cost_amount_minor : null,
                'installed_parts_cost_minor' => $installedPartsCostMinor,
                'currency_code' => $device->currency_code ?? 'UYU',
                'inventory_purpose' => $device->inventory_purpose,
                'consignor_id' => $validated['consignor_id'] ?? null,
                'sold_at' => $soldAt,
                'sold_by_actor_id' => (string) $request->user()->getAuthIdentifier(),
                'receipt_number' => $validated['receipt_number'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'status' => 'completed',
                'request_id' => $validated['request_id'],
            ]);

            $device->operational_status = 'vendido';
            $device->save();

            $this->audit($request, $saleRecord->id, 'DeviceSaleRecord', 'device.sold', [
                'inventory_item_id' => $device->id,
                'effective_sale_price_minor' => $saleRecord->effective_sale_price_minor,
                'initial_cost_amount_minor' => $saleRecord->initial_cost_amount_minor,
                'installed_parts_cost_minor' => $saleRecord->installed_parts_cost_minor,
                'inventory_purpose' => $saleRecord->inventory_purpose,
                'sold_at' => $soldAt->toIso8601String(),
            ]);

            return ['sale' => $saleRecord, 'replayed' => false];
        });

        return response()->json([
            'data' => $this->transformSale($result['sale']),
            'replayed' => $result['replayed'],
        ], $result['replayed'] ? 200 : 201);
    }

    public function void(Request $request, string $id, string $saleId): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:300'],
            'return_to_inventory' => ['sometimes', 'boolean'],
        ]);

        $returnToInventory = (bool) ($validated['return_to_inventory'] ?? true);

        $sale = DB::transaction(function () use ($request, $id, $saleId, $validated, $returnToInventory): DeviceSaleRecord {
            $device = InventoryItem::query()
                ->whereKey($id)
                ->lockForUpdate()
                ->firstOrFail();

            $sale = DeviceSaleRecord::query()
                ->whereKey($saleId)
                ->where('inventory_item_id', $device->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($sale->voided_at !== null) {
                throw ValidationException::withMessages([
                    'reason' => 'Esta venta ya fue anulada previamente.',
                ]);
            }

            $sale->status = 'voided';
            $sale->voided_at = now();
            $sale->voided_by_actor_id = (string) $request->user()->getAuthIdentifier();
            $sale->void_reason = trim($validated['reason']);
            $sale->return_to_inventory = $returnToInventory;
            $sale->save();

            if ($returnToInventory) {
                $device->operational_status = 'en_stock';
                $device->save();
            }

            $this->audit($request, $sale->id, 'DeviceSaleRecord', 'device.sale_voided', [
                'inventory_item_id' => $device->id,
                'effective_sale_price_minor' => $sale->effective_sale_price_minor,
                'reason' => $sale->void_reason,
                'return_to_inventory' => $returnToInventory,
            ]);

            return $sale;
        });

        return response()->json([
            'data' => $this->transformSale($sale),
        ]);
    }

    private function transformSale(DeviceSaleRecord $sale): array
    {
        return [
            'id' => $sale->id,
            'inventory_item_id' => $sale->inventory_item_id,
            'effective_sale_price_minor' => (int) $sale->effective_sale_price_minor,
            'initial_cost_amount_minor' => $sale->initial_cost_amount_minor !== null ? (int) $sale->initial_cost_amount_minor : null,
            'installed_parts_cost_minor' => (int) $sale->installed_parts_cost_minor,
            'currency_code' => $sale->currency_code,
            'inventory_purpose' => $sale->inventory_purpose,
            'consignor_id' => $sale->consignor_id,
            'sold_at' => $sale->sold_at?->toIso8601String(),
            'sold_by_actor_id' => $sale->sold_by_actor_id,
            'receipt_number' => $sale->receipt_number,
            'notes' => $sale->notes,
            'status' => $sale->status,
            'voided_at' => $sale->voided_at?->toIso8601String(),
            'voided_by_actor_id' => $sale->voided_by_actor_id,
            'void_reason' => $sale->void_reason,
            'return_to_inventory' => $sale->return_to_inventory,
            'created_at' => $sale->created_at?->toIso8601String(),
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
