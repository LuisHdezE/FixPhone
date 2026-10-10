<?php

namespace Tests\Feature;

use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\Identity\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class InventoryEndpointsTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsOwner(): void
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => 'Owner',
            'email' => 'inventory-owner@fixphone.test',
            'password' => Hash::make('test-secret-owner'),
            'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => 'owner']);
        Sanctum::actingAs($user);
    }

    public function test_admin_inventory_requires_authentication(): void
    {
        $this->getJson('/api/v1/admin/inventory')->assertUnauthorized();
        $this->postJson('/api/v1/admin/inventory', [])->assertUnauthorized();
    }


    public function test_devices_list_returns_real_device_inventory_and_excludes_non_devices(): void
    {
        $this->actingAsOwner();
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
        $this->actingAsOwner();
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

    private function minimalDevicePayload(string $model = 'iPhone 11'): array
    {
        return [
            'title' => 'Apple '.$model,
            'item_type' => 'used_phone',
            'brand' => 'Apple',
            'model' => $model,
            'operational_status' => 'para_deshuesar',
            'publication_status' => 'no_publicable',
            'inventory_purpose' => 'parts_donor',
            'is_sellable' => false,
            'stock_quantity' => 1,
            'metadata' => [
                'destination' => 'Donor',
                'serial_or_imei' => null,
                'physical_condition' => 'Unknown',
            ],
        ];
    }

    public function test_registering_two_devices_without_imei_allocates_distinct_permanent_fxp_codes(): void
    {
        $this->actingAsOwner();

        $first = $this->postJson('/api/v1/admin/inventory', $this->minimalDevicePayload())
            ->assertCreated()
            ->assertJsonPath('sku', 'FXP-0001')
            ->assertJsonPath('publication_status', 'no_publicable')
            ->assertJsonPath('is_sellable', false)
            ->assertJsonPath('metadata.serial_or_imei', null);

        $second = $this->postJson('/api/v1/admin/inventory', $this->minimalDevicePayload('iPhone XR'))
            ->assertCreated()
            ->assertJsonPath('sku', 'FXP-0002');

        $this->assertNotSame($first->json('id'), $second->json('id'));
        $this->assertSame(2, InventoryItem::query()->where('sku', 'like', 'FXP-%')->count());

        $list = $this->getJson('/api/v1/admin/inventory')->assertOk()->json('data');
        $this->assertEqualsCanonicalizing(['FXP-0001', 'FXP-0002'], array_column($list, 'sku'));
    }

    public function test_automatic_counter_skips_preexisting_code_without_reusing_it(): void
    {
        $this->actingAsOwner();

        $this->postJson('/api/v1/admin/inventory', $this->minimalDevicePayload())
            ->assertCreated()->assertJsonPath('sku', 'FXP-0001');

        // Simulates a pre-existing or imported legacy FXP code.
        InventoryItem::query()->create([
            'sku' => 'FXP-0002',
            'title' => 'Equipo histórico',
            'item_type' => 'used_phone',
            'operational_status' => 'ingresado',
            'publication_status' => 'no_publicable',
            'inventory_purpose' => 'internal_use',
            'stock_quantity' => 1,
        ]);

        $this->postJson('/api/v1/admin/inventory', $this->minimalDevicePayload('iPhone 12'))
            ->assertCreated()->assertJsonPath('sku', 'FXP-0003');

        // A removed historical record must not cause the issued number to be recycled.
        InventoryItem::query()->where('sku', 'FXP-0001')->delete();
        $this->postJson('/api/v1/admin/inventory', $this->minimalDevicePayload('iPhone 13'))
            ->assertCreated()->assertJsonPath('sku', 'FXP-0004');
    }

    public function test_spare_part_creation_does_not_consume_device_reference(): void
    {
        $this->actingAsOwner();
        $this->postJson('/api/v1/admin/inventory', [
            'title' => 'Pantalla de iPhone 11',
            'item_type' => 'spare_part',
            'operational_status' => 'en_stock',
            'publication_status' => 'no_publicable',
            'inventory_purpose' => 'sell_as_spare_part',
            'stock_quantity' => 1,
        ])->assertCreated()->assertJsonPath('sku', null);

        $this->postJson('/api/v1/admin/inventory', $this->minimalDevicePayload())
            ->assertCreated()->assertJsonPath('sku', 'FXP-0001');
    }

}
