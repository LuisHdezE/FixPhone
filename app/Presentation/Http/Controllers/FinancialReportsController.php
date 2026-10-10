<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Inventory\DeviceInstalledPart;
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

        $directSales = InventoryItem::query()
            ->whereIn('item_type', ['device', 'used_phone'])
            ->whereIn('inventory_purpose', ['sell_as_used_phone', 'repair_then_sell', 'venta_directa', 'direct_sale'])
            ->whereIn('operational_status', ['vendido', 'sold'])
            ->whereBetween('updated_at', [$startOfMonth, $endOfMonth])
            ->orderByDesc('updated_at')
            ->get();

        $deviceIds = $directSales->pluck('id')->all();
        $installedPartsGrouped = DeviceInstalledPart::query()
            ->whereIn('inventory_item_id', $deviceIds)
            ->whereNull('voided_at')
            ->get()
            ->groupBy('inventory_item_id');

        $settlements = [];
        $totalSalesMinor = 0;
        $totalInitialCostsMinor = 0;
        $totalPartsCostsMinor = 0;
        $totalSettlableProfitMinor = 0;
        $totalLiquidationMinor = 0;

        foreach ($directSales as $device) {
            $parts = $installedPartsGrouped->get($device->id, collect());
            $installedPartsCostMinor = (int) $parts->sum('cost_amount_minor');
            $salePriceMinor = (int) $device->sale_price_amount_minor;
            $initialCostMinor = $device->cost_amount_minor !== null ? (int) $device->cost_amount_minor : null;

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
                'device_id' => $device->id,
                'sku' => $device->sku,
                'title' => $device->title,
                'brand' => $device->brand,
                'model' => $device->model,
                'inventory_purpose' => $device->inventory_purpose,
                'operational_status' => $device->operational_status,
                'sale_price_amount_minor' => $salePriceMinor,
                'initial_cost_amount_minor' => $initialCostMinor,
                'installed_parts_cost_minor' => $installedPartsCostMinor,
                'installed_parts_count' => $parts->count(),
                'settlable_profit_minor' => $settlableProfitMinor,
                'liquidation_percentage' => 50,
                'liquidation_amount_minor' => $liquidationAmountMinor,
                'currency_code' => $device->currency_code ?? 'UYU',
                'status' => $settlementStatus,
                'status_label' => $statusLabel,
                'status_reason' => $statusReason,
                'sold_at' => $device->updated_at?->toIso8601String(),
            ];
        }

        return response()->json([
            'data' => [
                'period' => $yearMonth,
                'formula' => 'Liquidacion = 50% * (PrecioVenta - CostoInicialEquipo - CostoRepuestosInstalados)',
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
