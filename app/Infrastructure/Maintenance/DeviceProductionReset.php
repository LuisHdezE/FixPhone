<?php
namespace App\Infrastructure\Maintenance;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class DeviceProductionReset
{
    public const OPERATION = 'fixphone-device-reset-2026-10-15';
    public const CONFIRMATION = 'BORRAR DISPOSITIVOS FIXPHONE PRODUCCION';
    private const TABLES = [
        'device_technical_checks', 'device_technical_evaluations',
        'device_valuation_photos', 'device_valuations', 'device_sale_records',
        'device_installed_parts', 'inventory_stock_adjustments',
        'order_items', 'orders', 'inventory_items',
    ];

    public function run(bool $execute, string $fingerprint = '', string $confirmation = ''): array
    {
        $directory = storage_path('app/private/device-reset');
        if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new RuntimeException('Cannot create private backup directory.');
        }
        $lock = fopen($directory.'/operation.lock', 'c');
        if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) {
            throw new RuntimeException('Another reset is running.');
        }
        try {
            return DB::transaction(function () use ($execute, $fingerprint, $confirmation, $directory): array {
                if (DB::table('audit_events')->where('event_type', self::OPERATION)->exists()) {
                    throw new RuntimeException('This one-time reset has already completed.');
                }
                // Lock complete scanned ranges, including soft-deleted inventory and dependants.
                $rows = [];
                foreach (array_reverse(self::TABLES) as $table) {
                    $rows[$table] = DB::table($table)->orderBy('id')->lockForUpdate()->get()->map(fn ($row) => (array) $row)->all();
                }
                $ids = array_column(array_values(array_filter($rows['inventory_items'],
                    fn ($row) => in_array($row['item_type'], ['device', 'used_phone'], true))), 'id');
                $selected = [];
                $selected['inventory_items'] = array_values(array_filter($rows['inventory_items'], fn ($r) => in_array($r['id'], $ids, true)));
                foreach (['device_technical_evaluations', 'device_valuations', 'device_sale_records', 'device_installed_parts', 'inventory_stock_adjustments'] as $table) {
                    $selected[$table] = array_values(array_filter($rows[$table], fn ($r) => in_array($r['inventory_item_id'], $ids, true)));
                }
                $evaluations = array_column($selected['device_technical_evaluations'], 'id');
                $valuations = array_column($selected['device_valuations'], 'id');
                $selected['device_technical_checks'] = array_values(array_filter($rows['device_technical_checks'], fn ($r) => in_array($r['evaluation_id'], $evaluations, true)));
                $selected['device_valuation_photos'] = array_values(array_filter($rows['device_valuation_photos'], fn ($r) => in_array($r['device_valuation_id'], $valuations, true)));
                $orderIds = array_values(array_unique(array_column(array_values(array_filter($rows['order_items'], fn ($r) => in_array($r['inventory_item_id'], $ids, true))), 'order_id')));
                $selected['order_items'] = array_values(array_filter($rows['order_items'], fn ($r) => in_array($r['order_id'], $orderIds, true)));
                foreach ($selected['order_items'] as $item) {
                    if (!in_array($item['inventory_item_id'], $ids, true)) {
                        throw new RuntimeException('Mixed device/spare-part order found. Manual review required.');
                    }
                }
                $selected['orders'] = array_values(array_filter($rows['orders'], fn ($r) => in_array($r['id'], $orderIds, true)));
                // Keep security/audit evidence, FXP allocation and idempotency records.
                // Include all scanned rows in the fingerprint to detect edits between preview/apply.
                $hash = hash('sha256', json_encode($rows, JSON_THROW_ON_ERROR));
                $counts = array_map('count', $selected);
                if (!$execute) {
                    return ['operation' => self::OPERATION, 'mode' => 'preview', 'fingerprint' => $hash, 'delete_counts' => $counts];
                }
                if ($confirmation !== self::CONFIRMATION || !hash_equals($hash, $fingerprint)) {
                    throw new RuntimeException('Confirmation or preview fingerprint does not match. Run preview again.');
                }
                if ($ids === []) {
                    throw new RuntimeException('No devices to remove.');
                }
                $plaintext = json_encode(['operation' => self::OPERATION, 'created_at' => now()->toIso8601String(), 'fingerprint' => $hash, 'tables' => $selected], JSON_THROW_ON_ERROR);
                $encrypted = Crypt::encryptString($plaintext);
                $path = $directory.'/'.self::OPERATION.'-'.bin2hex(random_bytes(8)).'.enc';
                if (file_put_contents($path, $encrypted, LOCK_EX) !== strlen($encrypted)) {
                    throw new RuntimeException('Backup write failed; no records deleted.');
                }
                chmod($path, 0600);
                if (Crypt::decryptString((string) file_get_contents($path)) !== $plaintext) {
                    throw new RuntimeException('Backup verification failed; no records deleted.');
                }
                foreach (self::TABLES as $table) {
                    foreach (array_chunk(array_column($selected[$table], 'id'), 200) as $chunk) {
                        $deleted = DB::table($table)->whereIn('id', $chunk)->delete();
                        if ($deleted !== count($chunk)) {
                            throw new RuntimeException('Deletion count mismatch; transaction rolled back.');
                        }
                    }
                }
                DB::table('audit_events')->insert([
                    'id' => (string) \Illuminate\Support\Str::ulid(),
                    'event_type' => self::OPERATION, 'action' => 'production_device_reset',
                    'entity_type' => 'Maintenance', 'entity_id' => self::OPERATION,
                    'actor_type' => 'github_actions', 'actor_id' => 'manual-workflow',
                    'metadata' => json_encode(['counts' => $counts, 'fingerprint' => $hash, 'backup_file' => basename($path)], JSON_THROW_ON_ERROR),
                    'occurred_at' => now(),
                ]);
                return ['operation' => self::OPERATION, 'mode' => 'executed', 'deleted_counts' => $counts, 'remaining_devices' => DB::table('inventory_items')->whereIn('item_type', ['device', 'used_phone'])->count(), 'backup_verified' => true, 'backup_file' => basename($path)];
            });
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }
}
