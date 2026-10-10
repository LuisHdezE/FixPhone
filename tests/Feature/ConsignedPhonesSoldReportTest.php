<?php

namespace Tests\Feature;

use App\Infrastructure\Inventory\DeviceSaleRecord;
use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\Identity\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ConsignedPhonesSoldReportTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsOwner(): User
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => 'Owner',
            'email' => 'finance-owner-2@fixphone.test',
            'password' => Hash::make('not-used'),
            'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => 'owner']);
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_consigned_phones_sold_only_includes_consigned_devices()
    {
        $this->actingAsOwner();

        // 4 equipos consignados vendidos
        for ($i = 0; $i < 4; $i++) {
            $item = InventoryItem::create([
                'id' => (string) Str::ulid(),
                'sku' => 'CNS-' . $i,
                'title' => 'Consigned ' . $i,
                'item_type' => 'device',
                'publication_status' => 'draft',
                'inventory_purpose' => 'consigned_phone',
                'operational_status' => 'sold',
            ]);
            DeviceSaleRecord::create([
                'id' => (string) Str::ulid(),
                'inventory_item_id' => $item->id,
                'inventory_purpose' => 'consigned_phone',
                'sold_at' => now()->timezone('America/Montevideo'),
                'receipt_number' => 'R-CNS-' . $i,
                'consignor_name' => 'Juan ' . $i,
                'status' => 'completed',
                'effective_sale_price_minor' => 10000,
                'installed_parts_cost_minor' => 0,
                'sold_by_actor_id' => 'system',
            ]);
        }

        // 3 equipos propios vendidos
        for ($i = 0; $i < 3; $i++) {
            $item = InventoryItem::create([
                'id' => (string) Str::ulid(),
                'sku' => 'OWN-' . $i,
                'title' => 'Own ' . $i,
                'item_type' => 'device',
                'publication_status' => 'draft',
                'inventory_purpose' => 'sell_as_used_phone',
                'operational_status' => 'sold',
            ]);
            DeviceSaleRecord::create([
                'id' => (string) Str::ulid(),
                'inventory_item_id' => $item->id,
                'inventory_purpose' => 'sell_as_used_phone',
                'sold_at' => now()->timezone('America/Montevideo'),
                'receipt_number' => 'R-OWN-' . $i,
                'status' => 'completed',
                'effective_sale_price_minor' => 10000,
                'installed_parts_cost_minor' => 0,
                'sold_by_actor_id' => 'system',
            ]);
        }

        $response = $this->getJson('/api/v1/admin/reports/consigned-phones-sold?year_month=' . now()->timezone('America/Montevideo')->format('Y-m'));

        $response->assertStatus(200);
        $response->assertJsonPath('data.totals.total_consigned_sold_count', 4);
        $response->assertJsonCount(4, 'data.reports');
    }

    public function test_consigned_phones_excludes_voided_sales()
    {
        $this->actingAsOwner();

        $item = InventoryItem::create([
            'id' => (string) Str::ulid(),
            'sku' => 'CNS-VOID',
            'title' => 'Consigned Void',
            'item_type' => 'device',
            'publication_status' => 'draft',
            'inventory_purpose' => 'consigned_phone',
            'operational_status' => 'stock', // voided sale puts it back
        ]);
        DeviceSaleRecord::create([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $item->id,
            'inventory_purpose' => 'consigned_phone',
            'sold_at' => now()->timezone('America/Montevideo')->subDays(2),
            'receipt_number' => 'R-CNS-VOID',
            'status' => 'voided',
            'voided_at' => now(),
            'effective_sale_price_minor' => 10000,
            'installed_parts_cost_minor' => 0,
            'sold_by_actor_id' => 'system',
            'voided_by_actor_id' => 'system',
        ]);

        $response = $this->getJson('/api/v1/admin/reports/consigned-phones-sold?year_month=' . now()->timezone('America/Montevideo')->format('Y-m'));
        $response->assertStatus(200);
        $response->assertJsonPath('data.totals.total_consigned_sold_count', 0);
    }

    public function test_legacy_pending_conciliation()
    {
        $this->actingAsOwner();

        $item = InventoryItem::create([
            'id' => (string) Str::ulid(),
            'sku' => 'LEGACY',
            'title' => 'Legacy Consigned',
            'item_type' => 'device',
            'publication_status' => 'draft',
            'inventory_purpose' => 'consigned_phone',
            'operational_status' => 'vendido', // Legacy status
        ]);

        $response = $this->getJson('/api/v1/admin/reports/consigned-phones-sold?year_month=' . now()->timezone('America/Montevideo')->format('Y-m'));
        $response->assertStatus(200);
        $response->assertJsonPath('data.totals.total_consigned_sold_count', 0);
        $response->assertJsonCount(1, 'data.legacy_pending_conciliation');
        $response->assertJsonPath('data.legacy_pending_conciliation.0.device_id', $item->id);
    }
}
