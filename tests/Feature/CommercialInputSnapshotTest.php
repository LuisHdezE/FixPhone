<?php

namespace Tests\Feature;

use App\Application\CommercialDecision\CommercialInputSnapshot;
use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

final class CommercialInputSnapshotTest extends TestCase
{
    use RefreshDatabase;

    private function device(array $extra = []): InventoryItem
    {
        return InventoryItem::query()->create([...[
            'title' => 'Snapshot device', 'item_type' => 'device',
            'operational_status' => 'en_reparacion', 'publication_status' => 'no_publicable',
            'inventory_purpose' => 'repair_then_sell', 'stock_quantity' => 1,
            'cost_amount_minor' => 180000, 'currency_code' => 'UYU', 'dismantling_status' => 'not_started',
        ], ...$extra]);
    }

    private function part(InventoryItem $device, int $cost, string $currency = 'UYU', bool $voided = false): void
    {
        DB::table('device_installed_parts')->insert([
            'id' => (string) Str::ulid(), 'inventory_item_id' => $device->id,
            'part_name' => 'Pantalla', 'cost_amount_minor' => $cost, 'currency_code' => $currency,
            'installed_at' => now(), 'installed_by_actor_id' => 'test',
            'voided_at' => $voided ? now() : null, 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_snapshot_counts_only_active_costs_and_preserves_zero_cost_stock(): void
    {
        $device = $this->device();
        $this->part($device, 30000);
        $this->part($device, 0);
        $this->part($device, 90000, 'USD', true);
        $before = $device->fresh()->toArray();
        $snapshot = app(CommercialInputSnapshot::class)->forDevice($device->id);
        $this->assertSame(30000, $snapshot['installed_parts_cost_minor']);
        $this->assertTrue($snapshot['can_plan_whole_device_sale']);
        $this->assertSame($before, $device->fresh()->toArray());
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_mixed_currencies_are_not_summed_as_if_equal(): void
    {
        $device = $this->device();
        $this->part($device, 100, 'USD');
        $snapshot = app(CommercialInputSnapshot::class)->forDevice($device->id);
        $this->assertNull($snapshot['installed_parts_cost_minor']);
        $this->assertContains('installed_parts_cost_currency_or_amount', $snapshot['missing_inputs']);
    }

    public function test_stock_and_dismantling_are_checked_and_missing_cost_stays_unknown(): void
    {
        $device = $this->device(['stock_quantity' => 0, 'cost_amount_minor' => null, 'dismantling_status' => 'partial']);
        $snapshot = app(CommercialInputSnapshot::class)->forDevice($device->id);
        $this->assertFalse($snapshot['can_plan_whole_device_sale']);
        $this->assertNull($snapshot['acquisition_cost_minor']);
        $this->assertContains('acquisition_cost', $snapshot['missing_inputs']);
    }
}
