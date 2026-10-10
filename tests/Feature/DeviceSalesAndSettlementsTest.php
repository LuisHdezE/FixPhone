<?php

namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use App\Infrastructure\Inventory\DeviceInstalledPart;
use App\Infrastructure\Inventory\DeviceSaleRecord;
use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DeviceSalesAndSettlementsTest extends TestCase
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

    public function test_registering_transactional_sale_freezes_historical_costs_and_updates_status(): void
    {
        Sanctum::actingAs($this->admin);

        $device = InventoryItem::create([
            'id' => (string) Str::ulid(),
            'sku' => 'FXP-SALE-001',
            'title' => 'iPhone 11 128GB',
            'item_type' => 'used_phone',
            'brand' => 'Apple',
            'model' => 'iPhone 11',
            'operational_status' => 'en_stock',
            'publication_status' => 'draft',
            'inventory_purpose' => 'sell_as_used_phone',
            'cost_amount_minor' => 400000, // 4.000 UYU acquisition cost
            'sale_price_amount_minor' => 1000000, // 10.000 UYU catalog price
            'currency_code' => 'UYU',
            'stock_quantity' => 1,
        ]);

        DeviceInstalledPart::create([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $device->id,
            'part_name' => 'Batería iPhone 11',
            'cost_amount_minor' => 100000, // 1.000 UYU parts
            'currency_code' => 'UYU',
            'installed_at' => now(),
            'installed_by_actor_id' => $this->admin->id,
        ]);

        $requestId = (string) Str::uuid();

        // Register commercial sale
        $response = $this->postJson("/api/v1/admin/devices/{$device->id}/sell", [
            'request_id' => $requestId,
            'effective_sale_price_minor' => 1000000, // 10.000 UYU actual sale price
            'receipt_number' => 'REC-2026-001',
            'notes' => 'Venta en local pago contado',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.effective_sale_price_minor', 1000000)
            ->assertJsonPath('data.initial_cost_amount_minor', 400000)
            ->assertJsonPath('data.installed_parts_cost_minor', 100000)
            ->assertJsonPath('replayed', false);

        // Verify device status was changed to 'vendido'
        $this->assertEquals('vendido', $device->fresh()->operational_status);

        // Subsequent edit on inventory item catalog price -> does NOT change recorded historical sale price
        $device->update(['sale_price_amount_minor' => 1200000, 'title' => 'iPhone 11 Edited Title']);

        // Check report #54 uses frozen historical values
        $reportResponse = $this->getJson('/api/v1/admin/reports/direct-sales-settlements?year_month=' . now()->format('Y-m'));

        $reportResponse->assertStatus(200)
            ->assertJsonPath('data.period', now()->format('Y-m'))
            ->assertJsonPath('data.totals.total_direct_sales_count', 1)
            ->assertJsonPath('data.totals.total_sales_amount_minor', 1000000)
            ->assertJsonPath('data.totals.total_initial_costs_minor', 400000)
            ->assertJsonPath('data.totals.total_installed_parts_costs_minor', 100000)
            ->assertJsonPath('data.totals.total_settlable_profit_minor', 500000)
            ->assertJsonPath('data.totals.total_liquidation_amount_minor', 250000) // EXACT Option A 2.500 UYU!
            ->assertJsonPath('data.settlements.0.status', 'eligible')
            ->assertJsonPath('data.settlements.0.receipt_number', 'REC-2026-001');
    }

    public function test_duplicate_sale_on_already_sold_device_is_prevented(): void
    {
        Sanctum::actingAs($this->admin);

        $device = InventoryItem::create([
            'id' => (string) Str::ulid(),
            'sku' => 'FXP-DOUBLE-001',
            'title' => 'iPhone XR',
            'item_type' => 'used_phone',
            'operational_status' => 'en_stock',
            'publication_status' => 'draft',
            'inventory_purpose' => 'sell_as_used_phone',
            'cost_amount_minor' => 300000,
            'sale_price_amount_minor' => 600000,
            'currency_code' => 'UYU',
            'stock_quantity' => 1,
        ]);

        // First sale
        $this->postJson("/api/v1/admin/devices/{$device->id}/sell", [
            'request_id' => (string) Str::uuid(),
            'effective_sale_price_minor' => 600000,
        ])->assertStatus(201);

        // Second sale attempt -> 422 Unprocessable Entity
        $response = $this->postJson("/api/v1/admin/devices/{$device->id}/sell", [
            'request_id' => (string) Str::uuid(),
            'effective_sale_price_minor' => 600000,
        ]);

        $response->assertStatus(422);
    }

    public function test_voiding_sale_reverts_device_status_and_recalculates_settlement_report(): void
    {
        Sanctum::actingAs($this->admin);

        $device = InventoryItem::create([
            'id' => (string) Str::ulid(),
            'sku' => 'FXP-VOID-001',
            'title' => 'Samsung A52',
            'item_type' => 'used_phone',
            'operational_status' => 'en_stock',
            'publication_status' => 'draft',
            'inventory_purpose' => 'sell_as_used_phone',
            'cost_amount_minor' => 200000,
            'sale_price_amount_minor' => 400000,
            'currency_code' => 'UYU',
            'stock_quantity' => 1,
        ]);

        $saleRes = $this->postJson("/api/v1/admin/devices/{$device->id}/sell", [
            'request_id' => (string) Str::uuid(),
            'effective_sale_price_minor' => 400000,
        ]);

        $saleId = $saleRes->json('data.id');
        $this->assertEquals('vendido', $device->fresh()->operational_status);

        // Void sale with return to inventory
        $voidRes = $this->postJson("/api/v1/admin/devices/{$device->id}/sales/{$saleId}/void", [
            'reason' => 'Cliente ejerció derecho de devolución en 24 horas',
            'return_to_inventory' => true,
        ]);

        $voidRes->assertStatus(200)
            ->assertJsonPath('data.status', 'voided')
            ->assertJsonPath('data.return_to_inventory', true);

        // Verify status reverted to en_stock
        $this->assertEquals('en_stock', $device->fresh()->operational_status);

        // Verify report excludes voided sale
        $reportRes = $this->getJson('/api/v1/admin/reports/direct-sales-settlements?year_month=' . now()->format('Y-m'));

        $reportRes->assertStatus(200)
            ->assertJsonPath('data.totals.total_direct_sales_count', 0)
            ->assertJsonPath('data.totals.total_liquidation_amount_minor', 0);
    }

    public function test_legacy_sold_devices_without_sale_record_are_flagged_as_pending_review(): void
    {
        Sanctum::actingAs($this->admin);

        // Legacy sold device without DeviceSaleRecord entry
        InventoryItem::create([
            'id' => (string) Str::ulid(),
            'sku' => 'FXP-LEGACY-001',
            'title' => 'iPhone 7 Legacy',
            'item_type' => 'used_phone',
            'operational_status' => 'vendido',
            'publication_status' => 'draft',
            'inventory_purpose' => 'sell_as_used_phone',
            'cost_amount_minor' => 150000,
            'sale_price_amount_minor' => 300000,
            'currency_code' => 'UYU',
            'stock_quantity' => 0,
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/admin/reports/direct-sales-settlements?year_month=' . now()->format('Y-m'));

        $response->assertStatus(200)
            ->assertJsonPath('data.settlements.0.status', 'pending_review')
            ->assertJsonPath('data.settlements.0.status_label', 'Venta legacy pendiente de conciliación')
            ->assertJsonPath('data.settlements.0.liquidation_amount_minor', 0);
    }
}
