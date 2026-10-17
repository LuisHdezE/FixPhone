<?php

namespace Tests\Feature;

use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\MasterData\DeviceModelSpec;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

final class DeviceModelMasterDeletionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $user = \App\Infrastructure\Identity\User::query()->create([
            'id' => (string) \Illuminate\Support\Str::ulid(), 'name' => 'Owner',
            'email' => 'master-owner@example.test', 'password' => \Illuminate\Support\Facades\Hash::make('test-password'), 'active' => true,
        ]);
        \Illuminate\Support\Facades\DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => 'owner']);
        \Laravel\Sanctum\Sanctum::actingAs($user);
    }

    private const MODEL = 'model-iphone-11';
    private const URL = '/api/v1/admin/master-data/deviceModels/';

    public function test_rejects_deletion_when_legacy_device_uses_model_in_metadata(): void
    {
        $item = InventoryItem::query()->create([
            'sku' => 'FXP-'.Str::ulid(),
            'title' => 'iPhone 11 de prueba',
            'item_type' => 'used_phone',
            'brand' => 'Apple',
            'model' => 'iPhone 11',
            'operational_status' => 'ingresado',
            'publication_status' => 'no_publicable',
            'inventory_purpose' => 'internal_use',
            'stock_quantity' => 1,
            'metadata' => ['device_model_id' => self::MODEL],
        ]);

        $this->deleteJson(self::URL.self::MODEL)
            ->assertStatus(409)
            ->assertJsonPath('message', 'No se puede eliminar un modelo con dispositivos, variantes, ficha técnica o imágenes asociados.');
        $this->assertDatabaseHas('inventory_items', ['id' => $item->id]);
        $this->assertDatabaseHas('master_data_entries', ['id' => self::MODEL]);
    }

    public function test_rejects_deletion_when_normalized_specs_reference_model(): void
    {
        DeviceModelSpec::query()->create([
            'device_model_id' => self::MODEL,
            'specs_json' => ['wifi' => '802.11ac'],
        ]);

        $this->deleteJson(self::URL.self::MODEL)->assertStatus(409);
        $this->assertDatabaseHas('master_data_entries', ['id' => self::MODEL]);
    }

    public function test_unreferenced_model_can_still_be_deleted(): void
    {
        $this->deleteJson(self::URL.'model-p30-lite')
            ->assertOk()
            ->assertJsonPath('deleted', true);
    }

    public function test_rejects_deletion_when_new_device_model_fk_is_set(): void
    {
        $id = (string) Str::ulid();
        DB::table('inventory_items')->insert([
            'id' => $id,
            'title' => 'iPhone 11',
            'item_type' => 'used_phone',
            'operational_status' => 'ingresado',
            'publication_status' => 'no_publicable',
            'inventory_purpose' => 'internal_use',
            'device_model_id' => self::MODEL,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->deleteJson(self::URL.self::MODEL)->assertStatus(409);
    }
}
