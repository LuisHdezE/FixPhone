<?php
namespace Tests\Feature;

use App\Infrastructure\Inventory\SparePartCodeAllocator;
use App\Infrastructure\Maintenance\SparePartsProductionReset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

final class SparePartsProductionResetTest extends TestCase
{
    use RefreshDatabase;

    private function item(string $type = 'spare_part', string $sku = 'REP-LEGACY', bool $archived = false): string
    {
        $id = (string) Str::ulid();
        DB::table('inventory_items')->insert([
            'id' => $id, 'sku' => $sku, 'title' => 'Test', 'item_type' => $type,
            'operational_status' => 'en_stock', 'publication_status' => 'no_publicable',
            'inventory_purpose' => 'sell_as_spare_part', 'stock_quantity' => 5,
            'deleted_at' => $archived ? now() : null,
        ]);
        return $id;
    }

    public function test_preview_and_cleanup_preserve_phones_and_restart_only_spare_sequence(): void
    {
        $spare = $this->item();
        $this->item('spare_part', 'REP-ARCHIVED', true);
        $phone = $this->item('used_phone', 'FXP-0001');
        $deviceSequence = DB::table('inventory_device_sequences')->where('id', 1)->value('next_number');
        DB::table('inventory_spare_part_sequences')->where('id', 1)->update(['next_number' => 20]);
        DB::table('inventory_stock_adjustments')->insert([
            'id' => (string) Str::ulid(), 'inventory_item_id' => $spare, 'request_id' => (string) Str::uuid(),
            'quantity_before' => 4, 'quantity_delta' => 1, 'quantity_after' => 5,
            'reason' => 'Test adjustment', 'actor_id' => (string) Str::ulid(),
        ]);
        $service = new SparePartsProductionReset();
        $preview = $service->run(false);
        $this->assertSame(2, $preview['delete_counts']['inventory_items']);
        $this->assertDatabaseCount('inventory_items', 3);
        $result = $service->run(true, $preview['fingerprint'], SparePartsProductionReset::CONFIRMATION);
        $this->assertSame(0, $result['remaining_spares']);
        $this->assertTrue($result['backup_verified']);
        $this->assertDatabaseHas('inventory_items', ['id' => $phone]);
        $this->assertDatabaseCount('inventory_stock_adjustments', 0);
        $this->assertDatabaseHas('inventory_device_sequences', ['id' => 1, 'next_number' => $deviceSequence]);
        $this->assertSame('REP-0001', DB::transaction(fn () => SparePartCodeAllocator::reserve()));
        $path = storage_path('app/private/spare-reset/').$result['backup_file'];
        $backup = json_decode(Crypt::decryptString(file_get_contents($path)), true);
        $this->assertCount(2, $backup['tables']['inventory_items']);
        $this->assertSame(20, $backup['tables']['inventory_spare_part_sequences'][0]['next_number']);
        unlink($path);
        $this->expectException(RuntimeException::class);
        $service->run(false);
    }

    public function test_stale_preview_or_wrong_confirmation_does_not_delete(): void
    {
        $id = $this->item();
        $service = new SparePartsProductionReset();
        $preview = $service->run(false);
        foreach ([['wrong', $preview['fingerprint']], [SparePartsProductionReset::CONFIRMATION, str_repeat('0', 64)]] as [$confirmation, $hash]) {
            try {
                $service->run(true, $hash, $confirmation);
                $this->fail('Invalid approval was accepted.');
            } catch (RuntimeException $error) {
                $this->assertStringContainsString('confirmación', $error->getMessage());
            }
        }
        $this->assertDatabaseHas('inventory_items', ['id' => $id, 'stock_quantity' => 5]);
    }

    public function test_installed_spare_blocks_cleanup_and_keeps_financial_history(): void
    {
        $spare = $this->item();
        $phone = $this->item('used_phone', 'FXP-0001');
        DB::table('device_installed_parts')->insert([
            'id' => (string) Str::ulid(), 'inventory_item_id' => $phone, 'spare_part_item_id' => $spare,
            'part_name' => 'Pantalla', 'cost_amount_minor' => 100, 'installed_at' => now(),
            'installed_by_actor_id' => 'test',
        ]);
        try {
            (new SparePartsProductionReset())->run(false);
            $this->fail('Linked spare must block cleanup.');
        } catch (RuntimeException $error) {
            $this->assertStringContainsString('vinculados', $error->getMessage());
        }
        $this->assertDatabaseCount('inventory_items', 2);
        $this->assertDatabaseCount('device_installed_parts', 1);
    }

    public function test_allocator_preserves_archived_codes_and_transaction_rollback(): void
    {
        $this->item('spare_part', 'REP-0001', true);
        $this->assertSame('REP-0002', DB::transaction(fn () => SparePartCodeAllocator::reserve()));
        DB::beginTransaction();
        $this->assertSame('REP-0003', SparePartCodeAllocator::reserve());
        DB::rollBack();
        $this->assertSame('REP-0003', DB::transaction(fn () => SparePartCodeAllocator::reserve()));
    }

    public function test_reset_endpoint_requires_authentication(): void
    {
        $this->postJson('/api/_deploy/spare-parts-production-reset', ['mode' => 'execute'])->assertUnauthorized();
    }
}
