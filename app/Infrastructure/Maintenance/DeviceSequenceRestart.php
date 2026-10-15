<?php

namespace App\Infrastructure\Maintenance;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/** One-time, owner-authorized restart after the initial production cleanup. */
final class DeviceSequenceRestart
{
    public const EVENT = 'fixphone-device-sequence-restart-2026-10-15';

    public function run(): void
    {
        DB::transaction(function (): void {
            // Same lock order as device creation: allocator row before inventory.
            $sequence = DB::table('inventory_device_sequences')->where('id', 1)->lockForUpdate()->first();
            if ($sequence === null) {
                throw new RuntimeException('El contador FXP no está inicializado.');
            }
            if (DB::table('audit_events')->where('event_type', self::EVENT)->exists()) {
                return;
            }
            if (!DB::table('audit_events')->where('event_type', DeviceProductionReset::OPERATION)->exists()) {
                throw new RuntimeException('No consta la limpieza inicial de producción.');
            }

            $items = DB::table('inventory_items')->orderBy('id')->lockForUpdate()->get();
            if ($items->contains(fn ($item) => in_array($item->item_type, ['device', 'used_phone'], true) && $item->deleted_at === null)) {
                throw new RuntimeException('Retirá primero el dispositivo de prueba activo antes de reiniciar el contador.');
            }
            if ($items->contains(fn ($item) => $item->sku === 'FXP-0001')) {
                throw new RuntimeException('FXP-0001 ya está reservado, incluso si está archivado. No se reiniciará el contador.');
            }

            DB::table('inventory_device_sequences')->where('id', 1)->update(['next_number' => 1]);
            DB::table('audit_events')->insert([
                'id' => (string) Str::ulid(), 'event_type' => self::EVENT,
                'action' => 'restart_sequence', 'entity_type' => 'Maintenance',
                'entity_id' => 'inventory_device_sequences:1', 'actor_type' => 'deployment',
                'actor_id' => 'owner-authorized-production-start',
                'metadata' => json_encode(['previous_next_number' => (int) $sequence->next_number, 'next_number' => 1], JSON_THROW_ON_ERROR),
                'occurred_at' => now(),
            ]);
        });
    }
}
