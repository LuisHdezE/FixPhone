<?php

namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\RepairQuotes\RepairQuote;
use App\Infrastructure\Valuation\DeviceValuation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class OperationalDashboardEndpointTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsOwner(): User
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => 'Owner',
            'email' => 'dashboard-owner@fixphone.test',
            'password' => Hash::make('not-used'),
            'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => 'owner']);
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_dashboard_requires_authentication(): void
    {
        $this->getJson('/api/v1/admin/dashboard/operational')->assertUnauthorized();
    }

    public function test_dashboard_uses_real_persisted_counts_and_pending_report_states(): void
    {
        $user = $this->actingAsOwner();

        InventoryItem::query()->create([
            'sku' => 'FXP-0001',
            'title' => 'iPhone 11',
            'item_type' => 'used_phone',
            'operational_status' => 'ingresado',
            'publication_status' => 'no_publicable',
            'inventory_purpose' => 'repair_then_sell',
            'stock_quantity' => 1,
            'metadata' => ['reorder_point' => 1],
        ]);
        InventoryItem::query()->create([
            'sku' => 'PART-001',
            'title' => 'Bateria iPhone 11',
            'item_type' => 'spare_part',
            'operational_status' => 'en_stock',
            'publication_status' => 'borrador',
            'inventory_purpose' => 'sell_as_spare_part',
            'stock_quantity' => 0,
        ]);
        RepairQuote::query()->create([
            'customer_name' => 'Cliente',
            'customer_contact' => '099 000 000',
            'device_description' => 'iPhone 11',
            'device_tier' => 'media',
            'services' => [['name' => 'Revision', 'price_minor' => 10000]],
            'parts' => [],
            'parts_markup_percent' => 20,
            'services_subtotal_minor' => 10000,
            'parts_base_minor' => 0,
            'parts_total_minor' => 0,
            'courier_minor' => 0,
            'discount_minor' => 0,
            'total_minor' => 10000,
            'currency_code' => 'UYU',
            'created_by' => $user->id,
        ]);
        DeviceValuation::query()->create([
            'model_name' => 'iPhone 11',
            'fault_type' => 'display',
            'publication_status' => 'published',
            'created_by' => $user->id,
        ]);

        $this->getJson('/api/v1/admin/dashboard/operational')
            ->assertOk()
            ->assertJsonPath('data.inventory.total_items', 2)
            ->assertJsonPath('data.inventory.total_units', 1)
            ->assertJsonPath('data.inventory.stock_health.reorder', 1)
            ->assertJsonPath('data.inventory.stock_health.out_of_stock', 1)
            ->assertJsonPath('data.devices.total', 1)
            ->assertJsonPath('data.repair_quotes.total', 1)
            ->assertJsonPath('data.valuations.total', 1)
            ->assertJsonPath('data.valuations.published', 1)
            ->assertJsonPath('data.reports.financial.status', 'pending')
            ->assertJsonPath('data.reports.consignment_sales.status', 'pending');
    }
}
