<?php

namespace Tests\Feature;

use App\Infrastructure\Inventory\DeviceCodeAllocator;
use App\Infrastructure\Maintenance\DeviceProductionReset;
use App\Infrastructure\Maintenance\DeviceSequenceRestart;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

final class DeviceSequenceRestartTest extends TestCase
{
    use RefreshDatabase;

    private function cleanupMarker(): void
    {
        DB::table('audit_events')->insert([
            'id' => (string) Str::ulid(), 'event_type' => DeviceProductionReset::OPERATION,
            'action' => 'reset', 'entity_type' => 'Maintenance', 'entity_id' => 'test', 'occurred_at' => now(),
        ]);
        DB::table('inventory_device_sequences')->where('id', 1)->update(['next_number' => 203]);
    }

    private function device(string $sku, bool $archived): string
    {
        $id = (string) Str::ulid();
        DB::table('inventory_items')->insert([
            'id' => $id, 'sku' => $sku, 'title' => 'Test', 'item_type' => 'used_phone',
            'operational_status' => 'ingresado', 'publication_status' => 'no_publicable',
            'inventory_purpose' => 'internal_use', 'stock_quantity' => 1,
            'deleted_at' => $archived ? now() : null,
        ]);
        return $id;
    }

    public function test_restart_preserves_archived_device_and_is_not_repeated(): void
    {
        $this->cleanupMarker();
        $id = $this->device('FXP-0202', true);
        $service = new DeviceSequenceRestart();
        $service->run();
        $this->assertSame('FXP-0001', DB::transaction(fn () => DeviceCodeAllocator::reserve()));
        $service->run();
        $this->assertSame('FXP-0002', DB::transaction(fn () => DeviceCodeAllocator::reserve()));
        $this->assertDatabaseHas('inventory_items', ['id' => $id, 'sku' => 'FXP-0202']);
        $this->assertSame(1, DB::table('audit_events')->where('event_type', DeviceSequenceRestart::EVENT)->count());
        $audit = json_decode(DB::table('audit_events')->where('event_type', DeviceSequenceRestart::EVENT)->value('metadata'), true);
        $this->assertSame(203, $audit['previous_next_number']);
    }

    public function test_active_device_blocks_restart_and_preserves_counter(): void
    {
        $this->cleanupMarker();
        $this->device('FXP-0202', false);
        try {
            (new DeviceSequenceRestart())->run();
            $this->fail('An active device must prevent restart.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('activo', $exception->getMessage());
        }
        $this->assertDatabaseHas('inventory_device_sequences', ['id' => 1, 'next_number' => 203]);
        $this->assertSame(0, DB::table('audit_events')->where('event_type', DeviceSequenceRestart::EVENT)->count());
    }

    public function test_archived_first_code_blocks_restart(): void
    {
        $this->cleanupMarker();
        $this->device('FXP-0001', true);
        $this->expectException(RuntimeException::class);
        (new DeviceSequenceRestart())->run();
    }

    public function test_allocator_skips_archived_identifiers(): void
    {
        $this->device('FXP-0001', true);
        $this->assertSame('FXP-0002', DB::transaction(fn () => DeviceCodeAllocator::reserve()));
    }

    public function test_restart_requires_initial_cleanup_marker(): void
    {
        $this->expectException(RuntimeException::class);
        (new DeviceSequenceRestart())->run();
    }
}
