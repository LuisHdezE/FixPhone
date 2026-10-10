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
                'analytics' => [
                    'trend' => [
                        'title' => 'Nuevos dispositivos',
                        'description' => 'Dispositivos agregados en los últimos 7 días',
                        'periodLabel' => 'Últimos 7 días',
                        'series' => [
                            [
                                'id' => 'new_devices',
                                'label' => 'Equipos',
                                'tone' => 'brand',
                                'points' => collect(range(0, 6))->map(function ($days) {
                                    $date = now()->subDays(6 - $days)->startOfDay();
                                    return [
                                        'label' => $date->format('d/m'),
                                        'value' => \App\Infrastructure\Inventory\InventoryItem::whereIn('item_type', ['device', 'used_phone'])
                                            ->whereDate('created_at', $date)
                                            ->count()
                                    ];
                                })->all(),
                            ]
                        ]
                    ],
                    'distribution' => [
                        'title' => 'Distribución por tipo',
                        'description' => 'Composición del inventario',
                        'centerLabel' => 'Total',
                        'segments' => [
                            ['id' => 'phones', 'label' => 'Teléfonos', 'value' => $devices->count(), 'tone' => 'brand'],
                            ['id' => 'parts', 'label' => 'Repuestos', 'value' => $inventory->where('item_type', 'spare_part')->count(), 'tone' => 'info'],
                            ['id' => 'other', 'label' => 'Otros', 'value' => $inventory->whereNotIn('item_type', ['device', 'used_phone', 'spare_part'])->count(), 'tone' => 'neutral'],
                        ]
                    ],
                    'funnel' => [
                        'title' => 'Embudo de Operación',
                        'description' => 'De ingreso a venta',
                        'stages' => [
                            ['id' => 'total', 'label' => 'Total equipos', 'value' => $devices->count(), 'note' => 'Todos'],
                            ['id' => 'available', 'label' => 'En stock', 'value' => $devices->where('operational_status', 'en_stock')->count(), 'note' => 'Disponibles'],
                            ['id' => 'sold', 'label' => 'Vendidos', 'value' => $devices->where('operational_status', 'sold')->count(), 'note' => 'Salida'],
                        ]
                    ]
                ],
                'valuations' => [
                    'total' => (int) ($valuations?->total ?? 0),
                    'published' => (int) ($valuations?->published ?? 0),
                ],
                'reports' => [
                    'financial' => [
                        'status' => 'active',
                        'label' => 'Liquidaciones de ventas directas',
                        'reason' => 'Ver gastos de repuestos y liquidación del 50% por equipo.',
                        'url' => '/admin/finance/settlements'
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
