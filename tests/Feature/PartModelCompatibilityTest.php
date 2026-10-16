<?php

namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class PartModelCompatibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_explicit_shared_model_relation_controls_part_selection_and_installation(): void
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(), 'name' => 'Owner',
            'email' => 'compatible-parts@fixphone.test',
            'password' => Hash::make('test-password'), 'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => 'owner']);
        Sanctum::actingAs($user);
        foreach (['model-a22-5g', 'model-a22-lte'] as $modelId) {
            \App\Infrastructure\MasterData\MasterDataEntry::query()->create([
                'id' => $modelId, 'kind' => 'deviceModels',
                'payload' => ['id' => $modelId, 'name' => $modelId, 'brandId' => 'brand-samsung', 'active' => true],
            ]);
        }
        $device = InventoryItem::query()->create([
            'sku' => 'FXP-COMPAT-1', 'title' => 'Samsung Galaxy A22 5G',
            'brand' => 'Samsung', 'model' => 'Galaxy A22 5G',
            'item_type' => 'device', 'inventory_purpose' => 'repair_then_sell',
            'operational_status' => 'en_reparacion', 'publication_status' => 'no_publicable',
            'currency_code' => 'UYU', 'stock_quantity' => 1,
            'metadata' => ['device_model_id' => 'model-a22-5g', 'brand_id' => 'brand-samsung'],
        ]);
        $spare = InventoryItem::query()->create([
            'sku' => 'REP-COMPAT-1', 'title' => 'Parlante compatible',
            'brand' => 'Samsung', 'model' => 'Galaxy A22 LTE',
            'item_type' => 'spare_part', 'inventory_purpose' => 'sell_as_spare_part',
            'operational_status' => 'en_stock', 'publication_status' => 'no_publicable',
            'currency_code' => 'UYU', 'stock_quantity' => 2,
            'metadata' => ['device_model_id' => 'model-a22-lte', 'brand_id' => 'brand-samsung'],
        ]);
        DB::table('inventory_part_model_compatibilities')->insert([
            'id' => (string) Str::ulid(), 'inventory_item_id' => $spare->id,
            'device_model_id' => 'model-a22-lte', 'source' => 'catalog',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $url = "/api/v1/admin/devices/{$device->id}/compatible-parts";
        $this->getJson($url)->assertOk()->assertDontSee($spare->id);

        DB::table('inventory_part_model_compatibilities')->insert([
            'id' => (string) Str::ulid(), 'inventory_item_id' => $spare->id,
            'device_model_id' => 'model-a22-5g', 'source' => 'catalog',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->getJson($url)->assertOk()->assertJsonFragment(['id' => $spare->id]);
        $this->postJson("/api/v1/admin/devices/{$device->id}/installed-parts", [
            'request_id' => (string) Str::uuid(), 'part_name' => $spare->title,
            'cost_amount_minor' => 0, 'spare_part_item_id' => $spare->id,
        ])->assertCreated();
        $this->assertSame(1, $spare->fresh()->stock_quantity);
        $this->deleteJson('/api/v1/admin/master-data/deviceModels/model-a22-5g')->assertStatus(409);

    }
}
