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
        // 1. Run Seeder
        config(['app.demo_seeder_enabled' => true]);
        $this->seed(DemoSeeder::class);

        // 2. Validate counts
        $this->assertDatabaseCount('consignors', 30);
        
        // Items: 1 (required) + 80 (own) + 60 (consigned) + 40 (dismantle) + 20 (parts) = 201
        $this->assertDatabaseCount('inventory_items', 201);
        
        $consignorsCount = Consignor::count();
        $itemsCount = InventoryItem::count();
        $salesCount = DeviceSaleRecord::count();
        $partsCount = DeviceInstalledPart::count();

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
        echo "Consignantes: {$consignorsCount}\n";
        echo "Artículos: {$itemsCount}\n";
        echo "Ventas Registradas: {$salesCount}\n";
        echo "Repuestos Instalados: {$partsCount}\n";
        echo "Validación caso A: OK - Liquidación calculada en 2.500 UYU correctamente.\n";
        echo "----------------------------------\n";
    }
}
