<?php
namespace App\Infrastructure\Inventory;

use Illuminate\Database\Eloquent\Builder;

final class StorefrontCatalog
{
    public static function query(): Builder
    {
        return InventoryItem::query()->where('publication_status', 'publicado')
            ->where('is_sellable', true)->where('stock_quantity', '>', 0)
            ->where('sale_price_amount_minor', '>', 0)
            ->where(function ($query): void {
                $query->where(function ($devices): void {
                    $devices->whereIn('item_type', ['device', 'used_phone'])
                        ->where(function ($sale): void {
                            $sale->where('inventory_purpose', 'sell_as_used_phone')
                                ->orWhere('metadata->destination', 'Direct Sale');
                        });
                })->orWhere(function ($parts): void {
                    $parts->where('item_type', 'spare_part')
                        ->where('inventory_purpose', 'sell_as_spare_part');
                });
            })
            ->whereIn('operational_status', ['reparado', 'en_stock', 'disponible'])
            ->where(function ($query): void {
                $query->whereNull('metadata->origin')->orWhere('metadata->origin', '!=', 'recovered')
                    ->orWhere('metadata->part_condition', 'functional');
            });
    }
}
