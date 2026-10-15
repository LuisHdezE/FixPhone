<?php
namespace Tests\Feature;

use App\Infrastructure\Maintenance\DeviceProductionReset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class DeviceProductionResetTest extends TestCase
{
    use RefreshDatabase;

    private function item(string $type = 'device', bool $deleted = false): string
    {
        $id = (string) Str::ulid();
        DB::table('inventory_items')->insert([
            'id' => $id, 'title' => 'Reset test', 'item_type' => $type,
            'operational_status' => 'en_stock', 'publication_status' => 'borrador',
            'inventory_purpose' => 'sell_as_used_phone', 'stock_quantity' => 1,
            'deleted_at' => $deleted ? now() : null,
        ]);
        return $id;
    }

    public function test_preview_does_not_delete_and_apply_preserves_spares_catalog_and_sequence(): void
    {
        $device = $this->item();
        $softDeleted = $this->item('used_phone', true);
        $spare = $this->item('spare_part');
        $catalogCount = DB::table('master_data_entries')->count();
        $sequence = DB::table('inventory_device_sequences')->first()->next_number;
        $evaluation = (string) Str::ulid();
        DB::table('device_technical_evaluations')->insert([
            'id' => $evaluation, 'inventory_item_id' => $device, 'revision' => 1,
            'request_id' => (string) Str::uuid(), 'device_title_snapshot' => 'Test',
            'overall_result' => 'pending', 'evaluated_by_actor_id' => 'test',
            'technician_name_snapshot' => 'Test',
        ]);
        DB::table('device_technical_checks')->insert([
            'id' => (string) Str::ulid(), 'evaluation_id' => $evaluation,
            'check_key' => 'screen', 'result' => 'pending',
        ]);
        DB::table('device_sale_records')->insert([
            'id' => (string) Str::ulid(), 'inventory_item_id' => $device,
            'effective_sale_price_minor' => 100, 'inventory_purpose' => 'sell_as_used_phone',
            'sold_at' => now(), 'sold_by_actor_id' => 'test',
        ]);
        $service = new DeviceProductionReset();
        $preview = $service->run(false);
        $this->assertSame(2, $preview['delete_counts']['inventory_items']);
        $this->assertSame(3, DB::table('inventory_items')->count());
        $result = $service->run(true, $preview['fingerprint'], DeviceProductionReset::CONFIRMATION);
        $this->assertSame(0, $result['remaining_devices']);
        $this->assertTrue($result['backup_verified']);
        $this->assertDatabaseHas('inventory_items', ['id' => $spare]);
        $this->assertDatabaseMissing('inventory_items', ['id' => $device]);
        $this->assertDatabaseMissing('inventory_items', ['id' => $softDeleted]);
        $this->assertDatabaseCount('device_technical_checks', 0);
        $this->assertDatabaseCount('device_sale_records', 0);
        $this->assertSame($catalogCount, DB::table('master_data_entries')->count());
        $this->assertSame($sequence, DB::table('inventory_device_sequences')->first()->next_number);
        $path = storage_path('app/private/device-reset/').$result['backup_file'];
        $backup = json_decode(Crypt::decryptString(file_get_contents($path)), true, flags: JSON_THROW_ON_ERROR);
        $this->assertCount(2, $backup['tables']['inventory_items']);
        $this->assertCount(1, $backup['tables']['device_sale_records']);
        unlink($path);
        $this->expectException(\RuntimeException::class);
        $service->run(false);
    }

    public function test_changed_data_invalidates_preview_before_deletion(): void
    {
        $id = $this->item();
        $service = new DeviceProductionReset();
        $preview = $service->run(false);
        DB::table('inventory_items')->where('id', $id)->update(['title' => 'Changed']);
        try {
            $service->run(true, $preview['fingerprint'], DeviceProductionReset::CONFIRMATION);
            $this->fail('Stale preview was accepted.');
        } catch (\RuntimeException $exception) {
            $this->assertStringContainsString('fingerprint', $exception->getMessage());
        }
        $this->assertDatabaseHas('inventory_items', ['id' => $id]);
    }

    public function test_wrong_confirmation_cannot_delete_devices(): void
    {
        $id = $this->item();
        $service = new DeviceProductionReset();
        $preview = $service->run(false);
        try {
            $service->run(true, $preview['fingerprint'], 'incorrect');
            $this->fail('Incorrect confirmation was accepted.');
        } catch (\RuntimeException $exception) {
            $this->assertStringContainsString('Confirmation', $exception->getMessage());
        }
        $this->assertDatabaseHas('inventory_items', ['id' => $id]);
    }

    public function test_endpoint_requires_deploy_authentication(): void
    {
        $this->postJson('/api/_deploy/device-production-reset', ['mode' => 'execute'])
            ->assertUnauthorized();
    }
}
