<?php
namespace App\Infrastructure\Inventory;

use Illuminate\Support\Facades\DB;
use RuntimeException;

final class SparePartCodeAllocator
{
    /** Call inside the same transaction that creates the spare part. */
    public static function reserve(): string
    {
        $row = DB::table('inventory_spare_part_sequences')->where('id', 1)->lockForUpdate()->first();
        if ($row === null) {
            throw new RuntimeException('El contador de repuestos no está inicializado.');
        }
        $next = (int) $row->next_number;
        do {
            $code = sprintf('REP-%04d', $next++);
        } while (DB::table('inventory_items')->where('sku', $code)->exists());
        DB::table('inventory_spare_part_sequences')->where('id', 1)->update(['next_number' => $next]);
        return $code;
    }
}
