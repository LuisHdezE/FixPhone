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
use Illuminate\Validation\ValidationException;

final class FinancialReportsController extends Controller
{
    public function installedPartsExpenses(Request $request): JsonResponse
    {
        $request->validate([
            'year_month' => ['sometimes', 'nullable', 'regex:/^\d{4}-\d{2}$/'],
            'device_id' => ['sometimes', 'nullable', 'string'],
        ]);

        $yearMonth = $request->input('year_month') ?: now()->format('Y-m');
        try {
            $startOfMonth = Carbon::createFromFormat('Y-m-d H:i:s', $yearMonth . '-01 00:00:00')->startOfMonth();
            $endOfMonth = (clone $startOfMonth)->endOfMonth();
        } catch (\Throwable $e) {
            throw ValidationException::withMessages(['year_month' => 'Formato de período inválido. Use YYYY-MM.']);
        }

        $query = DeviceInstalledPart::query()
            ->whereNull('voided_at')
            ->whereBetween('installed_at', [$startOfMonth, $endOfMonth]);

        if ($request->filled('device_id')) {
            $query->where('inventory_item_id', $request->input('device_id'));
        }

        $parts = $query->orderByDesc('installed_at')->get();

        $deviceIds = $parts->pluck('inventory_item_id')->unique()->values()->all();
        $devices = InventoryItem::query()->whereIn('id', $deviceIds)->get()->keyBy('id');

        $byDevice = [];
        foreach ($parts->groupBy('inventory_item_id') as $deviceId => $deviceParts) {
            /** @var InventoryItem|null $device */
            $device = $devices->get($deviceId);
            $totalCost = (int) $deviceParts->sum('cost_amount_minor');
            $byDevice[] = [
                'device_id' => $deviceId,
                'sku' => $device?->sku,
                'title' => $device?->title ?? 'Equipo no encontrado',
                'brand' => $device?->brand,
                'model' => $device?->model,
                'parts_count' => $deviceParts->count(),
                'total_parts_cost_minor' => $totalCost,
                'currency_code' => $device?->currency_code ?? 'UYU',
                'parts' => $deviceParts->map(fn (DeviceInstalledPart $p) => [
                    'id' => $p->id,
                    'part_name' => $p->part_name,
                    'cost_amount_minor' => (int) $p->cost_amount_minor,
                    'installed_at' => $p->installed_at?->toIso8601String(),
                    'notes' => $p->notes,
                ])->values()->all(),
            ];
        }

        $totalExpensesMinor = (int) $parts->sum('cost_amount_minor');

        return response()->json([
            'data' => [
                'period' => $yearMonth,
                'total_expenses_minor' => $totalExpensesMinor,
                'total_parts_count' => $parts->count(),
                'total_devices_count' => count($byDevice),
                'currency_code' => 'UYU',
                'by_device' => $byDevice,
            ],
        ]);
    }

    public function directSalesSettlements(Request $request): JsonResponse
    {
        $request->validate([
            'year_month' => ['sometimes', 'nullable', 'regex:/^\d{4}-\d{2}$/'],
        ]);

        $yearMonth = $request->input('year_month') ?: now()->format('Y-m');
        try {
            $startOfMonth = Carbon::createFromFormat('Y-m-d H:i:s', $yearMonth . '-01 00:00:00')->startOfMonth();
            $endOfMonth = (clone $startOfMonth)->endOfMonth();
        } catch (\Throwable $e) {
            throw ValidationException::withMessages(['year_month' => 'Formato de período inválido. Use YYYY-MM.']);
        }

        // Query transactional sales from device_sale_records
        $salesRecords = DeviceSaleRecord::query()
            ->whereNull('voided_at')
            ->whereBetween('sold_at', [$startOfMonth, $endOfMonth])
            ->whereIn('inventory_purpose', ['sell_as_used_phone', 'repair_then_sell', 'venta_directa', 'direct_sale'])
            ->orderByDesc('sold_at')
            ->get();

        $deviceIds = $salesRecords->pluck('inventory_item_id')->all();
        $devices = InventoryItem::query()->whereIn('id', $deviceIds)->get()->keyBy('id');

        $settlements = [];
        $totalSalesMinor = 0;
        $totalInitialCostsMinor = 0;
        $totalPartsCostsMinor = 0;
        $totalSettlableProfitMinor = 0;
        $totalLiquidationMinor = 0;

        foreach ($salesRecords as $sale) {
            /** @var InventoryItem|null $device */
            $device = $devices->get($sale->inventory_item_id);

            $salePriceMinor = (int) $sale->effective_sale_price_minor;
            $initialCostMinor = $sale->initial_cost_amount_minor !== null ? (int) $sale->initial_cost_amount_minor : null;
            $installedPartsCostMinor = (int) $sale->installed_parts_cost_minor;

            $totalSalesMinor += $salePriceMinor;
            $totalPartsCostsMinor += $installedPartsCostMinor;

            if ($initialCostMinor === null) {
                $settlementStatus = 'pending_review';
                $statusLabel = 'Pendiente de revisión';
                $statusReason = 'Costo inicial de adquisición no registrado. Se requiere auditoría.';
                $settlableProfitMinor = null;
                $liquidationAmountMinor = 0;
            } else {
                $totalInitialCostsMinor += $initialCostMinor;
                $settlableProfitMinor = $salePriceMinor - $initialCostMinor - $installedPartsCostMinor;

                if ($settlableProfitMinor > 0) {
                    $liquidationAmountMinor = (int) floor($settlableProfitMinor * 0.50);
                    $settlementStatus = 'eligible';
                    $statusLabel = 'Liquidación calculada';
                    $statusReason = null;
                    $totalSettlableProfitMinor += $settlableProfitMinor;
                    $totalLiquidationMinor += $liquidationAmountMinor;
                } else {
                    $liquidationAmountMinor = 0;
                    $settlementStatus = 'negative_profit';
                    $statusLabel = 'Sin utilidad repartible';
                    $statusReason = 'La utilidad es nula o negativa. No se genera liquidación.';
                }
            }

            $settlements[] = [
                'sale_id' => $sale->id,
                'device_id' => $sale->inventory_item_id,
                'sku' => $device?->sku,
                'title' => $device?->title ?? 'Equipo no encontrado',
                'brand' => $device?->brand,
                'model' => $device?->model,
                'inventory_purpose' => $sale->inventory_purpose,
                'operational_status' => $device?->operational_status ?? 'vendido',
                'sale_price_amount_minor' => $salePriceMinor,
                'initial_cost_amount_minor' => $initialCostMinor,
                'installed_parts_cost_minor' => $installedPartsCostMinor,
                'settlable_profit_minor' => $settlableProfitMinor,
                'liquidation_percentage' => 50,
                'liquidation_amount_minor' => $liquidationAmountMinor,
                'currency_code' => $sale->currency_code ?? 'UYU',
                'status' => $settlementStatus,
                'status_label' => $statusLabel,
                'status_reason' => $statusReason,
                'receipt_number' => $sale->receipt_number,
                'sold_at' => $sale->sold_at?->toIso8601String(),
            ];
        }

        // Check legacy sold items without sale record (to guarantee zero silent omissions)
        $recordedDeviceIds = DeviceSaleRecord::query()->pluck('inventory_item_id')->all();
        $legacySoldDevices = InventoryItem::query()
            ->whereIn('item_type', ['device', 'used_phone'])
            ->whereIn('inventory_purpose', ['sell_as_used_phone', 'repair_then_sell', 'venta_directa', 'direct_sale'])
            ->whereIn('operational_status', ['vendido', 'sold'])
            ->whereNotIn('id', $recordedDeviceIds)
            ->whereBetween('updated_at', [$startOfMonth, $endOfMonth])
            ->get();

        foreach ($legacySoldDevices as $legacy) {
            $settlements[] = [
                'sale_id' => null,
                'device_id' => $legacy->id,
                'sku' => $legacy->sku,
                'title' => $legacy->title,
                'brand' => $legacy->brand,
                'model' => $legacy->model,
                'inventory_purpose' => $legacy->inventory_purpose,
                'operational_status' => $legacy->operational_status,
                'sale_price_amount_minor' => (int) ($legacy->sale_price_amount_minor ?? 0),
                'initial_cost_amount_minor' => $legacy->cost_amount_minor !== null ? (int) $legacy->cost_amount_minor : null,
                'installed_parts_cost_minor' => 0,
                'settlable_profit_minor' => null,
                'liquidation_percentage' => 50,
                'liquidation_amount_minor' => 0,
                'currency_code' => $legacy->currency_code ?? 'UYU',
                'status' => 'pending_review',
                'status_label' => 'Venta legacy pendiente de conciliación',
                'status_reason' => 'El equipo figura vendido sin registro transaccional en device_sale_records. Requiere registrar la operación de venta.',
                'receipt_number' => null,
                'sold_at' => $legacy->updated_at?->toIso8601String(),
            ];
        }

        return response()->json([
            'data' => [
                'period' => $yearMonth,
                'formula' => 'Liquidacion = 50% * (PrecioVentaReal - CostoInicialHistorico - CostoRepuestosHistorico)',
                'totals' => [
                    'total_direct_sales_count' => count($settlements),
                    'total_sales_amount_minor' => $totalSalesMinor,
                    'total_initial_costs_minor' => $totalInitialCostsMinor,
                    'total_installed_parts_costs_minor' => $totalPartsCostsMinor,
                    'total_settlable_profit_minor' => $totalSettlableProfitMinor,
                    'total_liquidation_amount_minor' => $totalLiquidationMinor,
                    'currency_code' => 'UYU',
                ],
                'settlements' => $settlements,
            ],
        ]);
    }
}
