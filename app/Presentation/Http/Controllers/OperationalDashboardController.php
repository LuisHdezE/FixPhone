<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\RepairQuotes\RepairQuote;
use App\Infrastructure\Valuation\DeviceValuation;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;

final class OperationalDashboardController extends Controller
{
    public function show(): JsonResponse
    {
        $inventory = InventoryItem::query()
            ->get(['id', 'sku', 'title', 'item_type', 'operational_status', 'publication_status', 'stock_quantity', 'metadata', 'updated_at']);

        $stock = ['healthy' => 0, 'reorder' => 0, 'out_of_stock' => 0, 'available_without_minimum' => 0];
        foreach ($inventory as $item) {
            $quantity = (int) $item->stock_quantity;
            $reorderPoint = $this->reorderPoint($item->metadata);
            if ($quantity <= 0) {
                $stock['out_of_stock']++;
            } elseif ($reorderPoint === null) {
                $stock['available_without_minimum']++;
            } elseif ($quantity <= $reorderPoint) {
                $stock['reorder']++;
            } else {
                $stock['healthy']++;
            }
        }

        $devices = $inventory->filter(fn (InventoryItem $item): bool => in_array($item->item_type, ['device', 'used_phone'], true));
        $quotesCount = RepairQuote::query()->count();
        $valuations = DeviceValuation::query()
            ->selectRaw('count(*) as total')
            ->selectRaw("sum(case when publication_status = 'published' then 1 else 0 end) as published")
            ->first();

        return response()->json([
            'data' => [
                'generated_at' => now()->toIso8601String(),
                'inventory' => [
                    'total_items' => $inventory->count(),
                    'total_units' => $inventory->sum(fn (InventoryItem $item): int => (int) $item->stock_quantity),
                    'stock_health' => $stock,
                    'by_type' => $inventory->groupBy('item_type')->map->count()->all(),
                ],
                'devices' => [
                    'total' => $devices->count(),
                    'by_status' => $devices->groupBy('operational_status')->map->count()->all(),
                    'latest' => $devices->sortByDesc('updated_at')->take(5)->values()->map(fn (InventoryItem $item): array => [
                        'id' => $item->id,
                        'sku' => $item->sku,
                        'title' => $item->title,
                        'status' => $item->operational_status,
                        'updated_at' => $item->updated_at?->toIso8601String(),
                    ])->all(),
                ],
                'repair_quotes' => [
                    'total' => $quotesCount,
                ],
                'valuations' => [
                    'total' => (int) ($valuations?->total ?? 0),
                    'published' => (int) ($valuations?->published ?? 0),
                ],
                'reports' => [
                    'financial' => [
                        'status' => 'pending',
                        'label' => 'Pendiente de habilitar',
                        'reason' => 'Los reportes financieros de ingresos, costos, pagos y saldos se activan con #54.',
                    ],
                    'consignment_sales' => [
                        'status' => 'pending',
                        'label' => 'Pendiente de habilitar',
                        'reason' => 'El detalle de teléfonos consignados vendidos se activa con #55.',
                    ],
                ],
            ],
        ]);
    }

    private function reorderPoint(mixed $metadata): ?int
    {
        $value = is_array($metadata) ? ($metadata['reorder_point'] ?? null) : null;
        return is_int($value) && $value >= 0 ? $value : null;
    }
}
