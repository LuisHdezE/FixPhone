<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Database\Seeders\DemoSeeder;
use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\Inventory\DeviceSaleRecord;
use App\Infrastructure\Inventory\DeviceInstalledPart;
use App\Infrastructure\Inventory\Consignor;
use App\Presentation\Http\Controllers\FinancialReportsController;
use Illuminate\Http\Request;
use App\Infrastructure\Identity\User;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DemoSeederValidationTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_seeder_populates_data_and_financial_reports_are_correct(): void
    {
        // Insert a non-demo record to verify it is NOT deleted
        $nonDemoConsignor = Consignor::create([
            'id' => (string) Str::ulid(),
            'full_name' => 'Real Customer No Demo',
            'document_number' => '99999999',
            'phone' => '099999999',
            'email' => 'real@example.com',
        ]);
        
        $nonDemoDevice = InventoryItem::create([
            'id' => (string) Str::ulid(),
            'sku' => 'FXP-REAL-1',
            'title' => 'Real Device',
            'item_type' => 'used_phone',
            'inventory_purpose' => 'sell_as_used_phone',
            'operational_status' => 'en_stock',
            'publication_status' => 'draft',
            'dismantling_status' => 'not_started',
            'is_sellable' => true,
            'stock_quantity' => 1,
            'cost_amount_minor' => 1000,
            'sale_price_amount_minor' => 2000,
            'currency_code' => 'UYU',
            'metadata' => [],
        ]);

        // 1. Run Seeder First Time
        config(['app.demo_seeder_enabled' => true]);
        config(['app.demo_seeder_allowed_databases' => [DB::connection()->getDatabaseName()]]);
        $this->seed(DemoSeeder::class);

        // 2. Validate counts after first run
        $this->assertDatabaseCount('consignors', 31); // 30 demo + 1 real
        
        // Items: 1 (required) + 80 (own) + 60 (consigned) + 40 (dismantle) + 20 (parts) + 1 real = 202
        $this->assertDatabaseCount('inventory_items', 202);
        
        $consignorsCount1 = Consignor::count();
        $itemsCount1 = InventoryItem::count();
        $salesCount1 = DeviceSaleRecord::count();
        $partsCount1 = DeviceInstalledPart::count();

        // 3. Run Seeder Second Time (Idempotency check)
        $this->seed(DemoSeeder::class);

        $this->assertEquals($consignorsCount1, Consignor::count(), 'Idempotency failed for consignors');
        $this->assertEquals($itemsCount1, InventoryItem::count(), 'Idempotency failed for inventory_items');
        $this->assertEquals($salesCount1, DeviceSaleRecord::count(), 'Idempotency failed for device_sale_records');
        $this->assertEquals($partsCount1, DeviceInstalledPart::count(), 'Idempotency failed for device_installed_parts');

        // Check non-demo data remains
        $this->assertDatabaseHas('consignors', ['id' => $nonDemoConsignor->id]);
        $this->assertDatabaseHas('inventory_items', ['id' => $nonDemoDevice->id]);

        // Check required financial case:
        $financialCase = InventoryItem::where('title', 'iPhone 11 (Demostración Financiera A)')->first();
        $this->assertNotNull($financialCase);
        $sale = DeviceSaleRecord::where('inventory_item_id', $financialCase->id)->first();
        $this->assertNotNull($sale);

        // Check the formula in the endpoint
        $admin = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => 'Owner Admin',
            'email' => 'owner@fixphone.test',
            'password' => Hash::make('password'),
            'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $admin->id, 'role_slug' => 'owner']);
        \Laravel\Sanctum\Sanctum::actingAs($admin);

        $response = $this->getJson('/api/v1/admin/reports/direct-sales-settlements');
        $response->assertStatus(200);

        $data = $response->json('data');
        
        // Calculate expected for this specific item:
        // Settlement = 50% * (10.000 - 4.000 - 1.000) = 50% * 5.000 = 2.500 UYU
        // Expressed in minor units: 250000
        
        $itemSettlement = collect($data['settlements'])->firstWhere('sale_id', $sale->id);
        $this->assertNotNull($itemSettlement, 'The direct sale should be present in the report');
        $this->assertEquals(1000000, $itemSettlement['sale_price_amount_minor']);
        $this->assertEquals(400000, $itemSettlement['initial_cost_amount_minor']);
        $this->assertEquals(100000, $itemSettlement['installed_parts_cost_minor']);
        $this->assertEquals(250000, $itemSettlement['liquidation_amount_minor']);

        // Check that consigned phones are NOT in direct sales settlements
        $consignedSales = DeviceSaleRecord::where('inventory_purpose', 'consigned_phone')->get();
        foreach ($consignedSales as $cSale) {
            $found = collect($data['settlements'])->firstWhere('sale_id', $cSale->id);
            $this->assertNull($found, 'Consigned sales MUST NOT be present in direct sales settlement report.');
        }

        // Print final stats for evidence
        echo "\n----------------------------------\n";
        echo "ENTORNO DEMO GENERADO\n";
        echo "Consignantes: {$consignorsCount1}\n";
        echo "Artículos: {$itemsCount1}\n";
        echo "Ventas Registradas: {$salesCount1}\n";
        echo "Repuestos Instalados: {$partsCount1}\n";
        echo "Validación caso A: OK - Liquidación calculada en 2.500 UYU correctamente.\n";
        echo "----------------------------------\n";
    }
}
