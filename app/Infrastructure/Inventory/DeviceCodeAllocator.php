<?php

namespace App\Infrastructure\Inventory;

use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Allocate an immutable display code for a physical device.
 *
 * Must be invoked inside the same DB transaction that creates the item.
 * MySQL locks the single counter row, preventing concurrent duplicate codes.
 */
final class DeviceCodeAllocator
{
    public static function reserve(): string
    {
        $row = DB::table('inventory_device_sequences')
            ->where('id', 1)
            ->lockForUpdate()
            ->first();

        if ($row === null) {
            throw new RuntimeException('El contador de códigos de dispositivos no está inicializado.');
        }

        $next = (int) $row->next_number;
        do {
            $code = sprintf('FXP-%04d', $next);
            $next++;
            // Maintain compatibility if an older or external import already used a code.
        } while (InventoryItem::query()->where('sku', $code)->exists());

        DB::table('inventory_device_sequences')
            ->where('id', 1)
            ->update(['next_number' => $next]);

        return $code;
    }
}
