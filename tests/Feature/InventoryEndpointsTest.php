<?php

namespace Tests\Feature;

use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class InventoryEndpointsTest extends TestCase
{
    use RefreshDatabase;

    public function test_devices_list_returns_real_device_inventory_and_excludes_non_devices(): void
    {
        InventoryItem::query()->create([
            'sku' => 'DEV-1001',
            'title' => 'iPhone 12 128 GB',
            'item_type' => 'used_phone',
            'brand' => 'Apple',
            'model' => 'iPhone 12',
            'operational_status' => 'ingresado',
            'publication_status' => 'borrador',
            'inventory_purpose' => 'repair_then_sell',
            'is_sellable' => false,
            'stock_quantity' => 1,
            'cost_amount_minor' => 15500,
            'currency_code' => 'USD',
            'metadata' => [
                'serial_or_imei' => '356700000001842',
                'storage' => '128 GB',
                'color' => 'Negro',
            ],
        ]);

        InventoryItem::query()->create([
            'sku' => 'PART-1001',
            'title' => 'Pantalla iPhone 12',
            'item_type' => 'spare_part',
            'operational_status' => 'en_stock',
            'publication_status' => 'publicado',
            'inventory_purpose' => 'sell_as_spare_part',
            'is_sellable' => true,
            'stock_quantity' => 1,
            'currency_code' => 'USD',
        ]);

        $this->getJson('/api/v1/admin/inventory')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.sku', 'DEV-1001')
            ->assertJsonPath('data.0.brand', 'Apple')
            ->assertJsonPath('data.0.metadata.serial_or_imei', '356700000001842');
    }

    public function test_device_intake_payload_is_persisted_and_listed(): void
    {
        $response = $this->postJson('/api/v1/admin/inventory', [
            'title' => 'Apple iPhone 12 128 GB',
            'item_type' => 'used_phone',
            'brand' => 'Apple',
            'model' => 'iPhone 12',
            'description' => 'Equipo de prueba',
            'operational_status' => 'ingresado',
            'publication_status' => 'no_publicable',
            'inventory_purpose' => 'internal_use',
            'is_sellable' => false,
            'stock_quantity' => 1,
            'cost_amount_minor' => 12000,
            'sale_price_amount_minor' => null,
            'currency_code' => 'USD',
            'metadata' => [
                'serial_or_imei' => '356700000009999',
                'storage' => '128 GB',
                'color' => 'Negro',
                'physical_condition' => 'Good',
                'powers_on' => 'Yes',
                'account_lock' => 'Clear',
                'acquisition_source' => 'Compra directa',
                'destination' => 'Pending Evaluation',
            ],
        ])->assertCreated()
            ->assertJsonPath('brand', 'Apple')
            ->assertJsonPath('metadata.serial_or_imei', '356700000009999');

        $id = $response->json('id');
        $this->assertIsString($id);

        $this->getJson('/api/v1/admin/inventory')
            ->assertOk()
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.metadata.destination', 'Pending Evaluation');
    }
}
