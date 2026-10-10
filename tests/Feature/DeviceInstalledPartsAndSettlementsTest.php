<?php

namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use App\Infrastructure\Inventory\DeviceInstalledPart;
use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DeviceInstalledPartsAndSettlementsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => 'Owner Admin',
            'email' => 'owner@fixphone.test',
            'password' => Hash::make('password'),
            'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $this->admin->id, 'role_slug' => 'owner']);
    }

    public function test_registering_installed_part_records_historical_cost_and_deducts_inventory_idempotently(): void
    {
        Sanctum::actingAs($this->admin);

        $device = InventoryItem::create([
            'id' => (string) Str::ulid(),
            'sku' => 'FXP-000100',
            'title' => 'iPhone 11 64GB',
            'item_type' => 'used_phone',
            'brand' => 'Apple',
            'model' => 'iPhone 11',
            'operational_status' => 'en_reparacion',
            'publication_status' => 'draft',
            'inventory_purpose' => 'sell_as_used_phone',
            'cost_amount_minor' => 400000, // 4.000 UYU
            'sale_price_amount_minor' => 1000000, // 10.000 UYU
            'currency_code' => 'UYU',
            'stock_quantity' => 1,
        ]);

        $sparePart = InventoryItem::create([
            'id' => (string) Str::ulid(),
            'sku' => 'REP-BAT-001',
            'title' => 'Batería iPhone 11',
            'item_type' => 'spare_part',
            'operational_status' => 'en_stock',
            'publication_status' => 'draft',
            'inventory_purpose' => 'sell_as_spare_part',
            'cost_amount_minor' => 100000, // 1.000 UYU
            'sale_price_amount_minor' => 150000,
            'currency_code' => 'UYU',
            'stock_quantity' => 5,
        ]);

        $requestId = (string) Str::uuid();

        // 1. Register installed part
        $response = $this->postJson("/api/v1/admin/devices/{$device->id}/installed-parts", [
            'request_id' => $requestId,
            'part_name' => 'Batería iPhone 11',
            'cost_amount_minor' => 100000,
            'spare_part_item_id' => $sparePart->id,
            'notes' => 'Batería nueva 100% condición',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.part_name', 'Batería iPhone 11')
            ->assertJsonPath('data.cost_amount_minor', 100000)
            ->assertJsonPath('replayed', false);

        // Verify spare part stock was decremented from 5 to 4
        $this->assertEquals(4, $sparePart->fresh()->stock_quantity);

        // 2. Replay same request_id -> idempotent response without duplicate stock deduction
        $replayResponse = $this->postJson("/api/v1/admin/devices/{$device->id}/installed-parts", [
            'request_id' => $requestId,
            'part_name' => 'Batería iPhone 11',
            'cost_amount_minor' => 100000,
            'spare_part_item_id' => $sparePart->id,
        ]);

        $replayResponse->assertStatus(200)->assertJsonPath('replayed', true);
        $this->assertEquals(4, $sparePart->fresh()->stock_quantity);

        // 3. Change spare part catalog price in inventory later -> verify historical cost in installed parts remains 100.000
        $sparePart->update(['cost_amount_minor' => 120000]);

        $listResponse = $this->getJson("/api/v1/admin/devices/{$device->id}/installed-parts");

        $listResponse->assertStatus(200)
            ->assertJsonPath('data.total_installed_parts_cost_minor', 100000)
            ->assertJsonPath('data.installed_parts.0.cost_amount_minor', 100000);
    }

    public function test_official_option_a_formula_for_direct_sales_settlement(): void
    {
        Sanctum::actingAs($this->admin);

        // Obligatory test case from prompt:
        // Sale price: 10.000 UYU (1.000.000 minor)
        // Initial acquisition cost: 4.000 UYU (400.000 minor)
        // Installed parts: 1.000 UYU (100.000 minor)
        // Settlable profit: 5.000 UYU (500.000 minor)
        // 50% Liquidation: 2.500 UYU (250.000 minor)

        $device = InventoryItem::create([
            'id' => (string) Str::ulid(),
            'sku' => 'FXP-000200',
            'title' => 'iPhone XR 128GB',
            'item_type' => 'used_phone',
            'operational_status' => 'vendido',
            'publication_status' => 'draft',
            'inventory_purpose' => 'sell_as_used_phone', // Direct sale
            'cost_amount_minor' => 400000, // 4.000 UYU initial cost
            'sale_price_amount_minor' => 1000000, // 10.000 UYU sale price
            'currency_code' => 'UYU',
            'stock_quantity' => 0,
            'updated_at' => now(),
        ]);

        DeviceInstalledPart::create([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $device->id,
            'part_name' => 'Pantalla OLED',
            'cost_amount_minor' => 100000, // 1.000 UYU parts cost
            'currency_code' => 'UYU',
            'installed_at' => now(),
            'installed_by_actor_id' => $this->admin->id,
        ]);

        $response = $this->getJson('/api/v1/admin/reports/direct-sales-settlements?year_month=' . now()->format('Y-m'));

        $response->assertStatus(200)
            ->assertJsonPath('data.period', now()->format('Y-m'))
            ->assertJsonPath('data.totals.total_direct_sales_count', 1)
            ->assertJsonPath('data.totals.total_sales_amount_minor', 1000000)
            ->assertJsonPath('data.totals.total_initial_costs_minor', 400000)
            ->assertJsonPath('data.totals.total_installed_parts_costs_minor', 100000)
            ->assertJsonPath('data.totals.total_settlable_profit_minor', 500000)
            ->assertJsonPath('data.totals.total_liquidation_amount_minor', 250000) // EXACT 2.500 UYU!
            ->assertJsonPath('data.settlements.0.status', 'eligible')
            ->assertJsonPath('data.settlements.0.settlable_profit_minor', 500000)
            ->assertJsonPath('data.settlements.0.liquidation_amount_minor', 250000);
    }

    public function test_unknown_initial_cost_marks_settlement_as_pending_review(): void
    {
        Sanctum::actingAs($this->admin);

        $device = InventoryItem::create([
            'id' => (string) Str::ulid(),
            'sku' => 'FXP-000300',
            'title' => 'Samsung S20',
            'item_type' => 'used_phone',
            'operational_status' => 'vendido',
            'publication_status' => 'draft',
            'inventory_purpose' => 'venta_directa',
            'cost_amount_minor' => null, // UNKNOWN acquisition cost
            'sale_price_amount_minor' => 800000,
            'currency_code' => 'UYU',
            'stock_quantity' => 0,
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/admin/reports/direct-sales-settlements?year_month=' . now()->format('Y-m'));

        $response->assertStatus(200)
            ->assertJsonPath('data.settlements.0.status', 'pending_review')
            ->assertJsonPath('data.settlements.0.liquidation_amount_minor', 0)
            ->assertJsonPath('data.settlements.0.settlable_profit_minor', null);
    }

    public function test_negative_or_zero_profit_generates_zero_liquidation(): void
    {
        Sanctum::actingAs($this->admin);

        $device = InventoryItem::create([
            'id' => (string) Str::ulid(),
            'sku' => 'FXP-000400',
            'title' => 'iPhone 8',
            'item_type' => 'used_phone',
            'operational_status' => 'vendido',
            'publication_status' => 'draft',
            'inventory_purpose' => 'repair_then_sell',
            'cost_amount_minor' => 500000, // 5.000 UYU cost
            'sale_price_amount_minor' => 400000, // 4.000 UYU sale (loss!)
            'currency_code' => 'UYU',
            'stock_quantity' => 0,
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/admin/reports/direct-sales-settlements?year_month=' . now()->format('Y-m'));

        $response->assertStatus(200)
            ->assertJsonPath('data.settlements.0.status', 'negative_profit')
            ->assertJsonPath('data.settlements.0.settlable_profit_minor', -100000)
            ->assertJsonPath('data.settlements.0.liquidation_amount_minor', 0);
    }

    public function test_consignment_sales_are_excluded_from_direct_sales_settlements(): void
    {
        Sanctum::actingAs($this->admin);

        // Direct sale device
        InventoryItem::create([
            'id' => (string) Str::ulid(),
            'sku' => 'FXP-DIR-001',
            'title' => 'Venta Directa Device',
            'item_type' => 'used_phone',
            'operational_status' => 'vendido',
            'publication_status' => 'draft',
            'inventory_purpose' => 'sell_as_used_phone',
            'cost_amount_minor' => 300000,
            'sale_price_amount_minor' => 600000,
            'currency_code' => 'UYU',
            'stock_quantity' => 0,
            'updated_at' => now(),
        ]);

        // Consignment device (must be excluded from direct sales report)
        InventoryItem::create([
            'id' => (string) Str::ulid(),
            'sku' => 'FXP-CON-001',
            'title' => 'Consignment Device',
            'item_type' => 'used_phone',
            'operational_status' => 'vendido',
            'publication_status' => 'draft',
            'inventory_purpose' => 'consignacion',
            'cost_amount_minor' => 300000,
            'sale_price_amount_minor' => 600000,
            'currency_code' => 'UYU',
            'stock_quantity' => 0,
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/admin/reports/direct-sales-settlements?year_month=' . now()->format('Y-m'));

        $response->assertStatus(200)
            ->assertJsonPath('data.totals.total_direct_sales_count', 1)
            ->assertJsonPath('data.settlements.0.sku', 'FXP-DIR-001');
    }

    public function test_auditable_voiding_reverts_inventory_when_returned_to_stock(): void
    {
        Sanctum::actingAs($this->admin);

        $device = InventoryItem::create([
            'id' => (string) Str::ulid(),
            'sku' => 'FXP-000500',
            'title' => 'Xiaomi Redmi Note 10',
            'item_type' => 'used_phone',
            'operational_status' => 'en_reparacion',
            'publication_status' => 'draft',
            'inventory_purpose' => 'sell_as_used_phone',
            'currency_code' => 'UYU',
            'stock_quantity' => 1,
        ]);

        $sparePart = InventoryItem::create([
            'id' => (string) Str::ulid(),
            'sku' => 'REP-SCR-001',
            'title' => 'Pantalla Redmi Note 10',
            'item_type' => 'spare_part',
            'operational_status' => 'en_stock',
            'publication_status' => 'draft',
            'inventory_purpose' => 'sell_as_spare_part',
            'cost_amount_minor' => 80000,
            'currency_code' => 'UYU',
            'stock_quantity' => 2,
        ]);

        // Add installed part
        $addResponse = $this->postJson("/api/v1/admin/devices/{$device->id}/installed-parts", [
            'request_id' => (string) Str::uuid(),
            'part_name' => 'Pantalla Redmi Note 10',
            'cost_amount_minor' => 80000,
            'spare_part_item_id' => $sparePart->id,
        ]);

        $partId = $addResponse->json('data.id');
        $this->assertEquals(1, $sparePart->fresh()->stock_quantity);

        // Void installed part with physical return to stock
        $voidResponse = $this->postJson("/api/v1/admin/devices/{$device->id}/installed-parts/{$partId}/void", [
            'reason' => 'Part was intact and returned to inventory',
            'return_to_stock' => true,
        ]);

        $voidResponse->assertStatus(200);
        $this->assertEquals(2, $sparePart->fresh()->stock_quantity);
    }

    public function test_modifying_parts_on_sold_device_is_forbidden(): void
    {
        Sanctum::actingAs($this->admin);

        $soldDevice = InventoryItem::create([
            'id' => (string) Str::ulid(),
            'sku' => 'FXP-SOLD-001',
            'title' => 'iPhone 12 Sold',
            'item_type' => 'used_phone',
            'operational_status' => 'vendido', // Already sold and settled
            'publication_status' => 'draft',
            'inventory_purpose' => 'sell_as_used_phone',
            'cost_amount_minor' => 500000,
            'sale_price_amount_minor' => 900000,
            'currency_code' => 'UYU',
            'stock_quantity' => 0,
        ]);

        // Trying to add part after sale -> 422 Unprocessable Entity
        $response = $this->postJson("/api/v1/admin/devices/{$soldDevice->id}/installed-parts", [
            'request_id' => (string) Str::uuid(),
            'part_name' => 'Late Part',
            'cost_amount_minor' => 50000,
        ]);

        $response->assertStatus(422);
    }

    public function test_voiding_without_physical_return_does_not_increment_stock(): void
    {
        Sanctum::actingAs($this->admin);

        $device = InventoryItem::create([
            'id' => (string) Str::ulid(),
            'sku' => 'FXP-000600',
            'title' => 'Moto G30',
            'item_type' => 'used_phone',
            'operational_status' => 'en_reparacion',
            'publication_status' => 'draft',
            'inventory_purpose' => 'sell_as_used_phone',
            'currency_code' => 'UYU',
            'stock_quantity' => 1,
        ]);

        $sparePart = InventoryItem::create([
            'id' => (string) Str::ulid(),
            'sku' => 'REP-BAT-002',
            'title' => 'Batería Moto G30',
            'item_type' => 'spare_part',
            'operational_status' => 'en_stock',
            'publication_status' => 'draft',
            'inventory_purpose' => 'sell_as_spare_part',
            'cost_amount_minor' => 50000,
            'currency_code' => 'UYU',
            'stock_quantity' => 3,
        ]);

        $addResponse = $this->postJson("/api/v1/admin/devices/{$device->id}/installed-parts", [
            'request_id' => (string) Str::uuid(),
            'part_name' => 'Batería Moto G30',
            'cost_amount_minor' => 50000,
            'spare_part_item_id' => $sparePart->id,
        ]);

        $partId = $addResponse->json('data.id');
        $this->assertEquals(2, $sparePart->fresh()->stock_quantity);

        // Void without physical stock return (damaged/destroyed part during test)
        $voidResponse = $this->postJson("/api/v1/admin/devices/{$device->id}/installed-parts/{$partId}/void", [
            'reason' => 'Part damaged during installation, discarded',
            'return_to_stock' => false,
        ]);

        $voidResponse->assertStatus(200);
        // Stock remains 2 (not returned)
        $this->assertEquals(2, $sparePart->fresh()->stock_quantity);
    }
}
