<?php
namespace App\Infrastructure\Maintenance;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

final class SparePartsProductionReset
{
    public const OPERATION = 'fixphone-spare-reset-2026-10-15';
    public const CONFIRMATION = 'BORRAR REPUESTOS FIXPHONE PRODUCCION';

    public function run(bool $execute, string $fingerprint = '', string $confirmation = ''): array
    {
        return DB::transaction(function () use ($execute, $fingerprint, $confirmation): array {
            // Same locking order as spare-part creation.
            $sequence = DB::table('inventory_spare_part_sequences')->where('id', 1)->lockForUpdate()->first();
            if ($sequence === null) {
                throw new RuntimeException('El contador de repuestos no está inicializado.');
            }
            if (DB::table('audit_events')->where('event_type', self::OPERATION)->exists()) {
                throw new RuntimeException('La limpieza única de repuestos ya fue completada.');
            }
            $all = DB::table('inventory_items')->orderBy('id')->lockForUpdate()->get();
            $spares = $all->filter(fn ($item) => $item->item_type === 'spare_part')->values();
            $ids = $spares->pluck('id')->all();
            if ($all->contains(fn ($item) => $item->item_type !== 'spare_part' && $item->sku === 'REP-0001')) {
                throw new RuntimeException('REP-0001 pertenece a otro artículo que no se borrará. Revisá ese código antes de reiniciar.');
            }
            if (DB::table('order_items')->whereIn('inventory_item_id', $ids)->exists()
                || DB::table('device_sale_records')->whereIn('inventory_item_id', $ids)->exists()
                || DB::table('device_installed_parts')->where(function ($query) use ($ids): void {
                    $query->whereIn('inventory_item_id', $ids)->orWhereIn('spare_part_item_id', $ids);
                })->exists()
                || DB::table('device_valuations')->whereIn('inventory_item_id', $ids)->exists()
                || DB::table('device_technical_evaluations')->whereIn('inventory_item_id', $ids)->exists()) {
                throw new RuntimeException('Hay repuestos vinculados a pedidos, ventas, instalaciones o fichas técnicas. Revisá esas relaciones antes de limpiar.');
            }
            $adjustments = DB::table('inventory_stock_adjustments')->whereIn('inventory_item_id', $ids)->orderBy('id')->lockForUpdate()->get();
            $snapshot = [
                'inventory_items' => $spares->all(),
                'inventory_stock_adjustments' => $adjustments->all(),
                'inventory_spare_part_sequences' => [(array) $sequence],
            ];
            $hash = hash('sha256', json_encode($snapshot, JSON_THROW_ON_ERROR));
            $counts = ['inventory_items' => count($ids), 'inventory_stock_adjustments' => $adjustments->count()];
            if (!$execute) {
                return ['operation' => self::OPERATION, 'mode' => 'preview', 'fingerprint' => $hash, 'delete_counts' => $counts,
                    'preserved_items' => $all->count() - count($ids), 'current_next_number' => (int) $sequence->next_number,
                    'next_spare_code_after_reset' => 'REP-0001'];
            }
            if ($confirmation !== self::CONFIRMATION || !hash_equals($hash, $fingerprint)) {
                throw new RuntimeException('La confirmación o huella no coincide. Ejecutá nuevamente la vista previa.');
            }

            $directory = storage_path('app/private/spare-reset');
            if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
                throw new RuntimeException('No se pudo crear el directorio privado de respaldo.');
            }
            $plain = json_encode(['operation' => self::OPERATION, 'created_at' => now()->toIso8601String(),
                'fingerprint' => $hash, 'tables' => $snapshot], JSON_THROW_ON_ERROR);
            $encrypted = Crypt::encryptString($plain);
            $path = $directory.'/'.self::OPERATION.'-'.bin2hex(random_bytes(8)).'.enc';
            if (file_put_contents($path, $encrypted, LOCK_EX) !== strlen($encrypted)) {
                throw new RuntimeException('Falló la escritura del respaldo. No se borró ningún repuesto.');
            }
            chmod($path, 0600);
            if (Crypt::decryptString((string) file_get_contents($path)) !== $plain) {
                throw new RuntimeException('Falló la verificación del respaldo. No se borró ningún repuesto.');
            }
            foreach (array_chunk($ids, 200) as $chunk) {
                DB::table('inventory_stock_adjustments')->whereIn('inventory_item_id', $chunk)->delete();
                if (DB::table('inventory_items')->whereIn('id', $chunk)->delete() !== count($chunk)) {
                    throw new RuntimeException('Diferencia de recuentos. Se revierte la transacción.');
                }
            }
            DB::table('inventory_spare_part_sequences')->where('id', 1)->update(['next_number' => 1]);
            DB::table('audit_events')->insert([
                'id' => (string) Str::ulid(), 'event_type' => self::OPERATION,
                'action' => 'production_spare_reset', 'entity_type' => 'Maintenance', 'entity_id' => self::OPERATION,
                'actor_type' => 'github_actions', 'actor_id' => 'manual-workflow',
                'metadata' => json_encode(['counts' => $counts, 'fingerprint' => $hash, 'backup_file' => basename($path),
                    'previous_next_number' => (int) $sequence->next_number, 'next_number' => 1], JSON_THROW_ON_ERROR),
                'occurred_at' => now(),
            ]);
            return ['operation' => self::OPERATION, 'mode' => 'executed', 'deleted_counts' => $counts,
                'remaining_spares' => DB::table('inventory_items')->where('item_type', 'spare_part')->count(),
                'next_spare_code' => 'REP-0001', 'backup_verified' => true, 'backup_file' => basename($path)];
        });
    }
}
