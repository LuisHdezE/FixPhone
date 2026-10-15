<?php

namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use App\Infrastructure\MasterData\MasterDataEntry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class SparePartsInventoryTest extends TestCase
{
    use RefreshDatabase;

    private function signIn(string $role): void
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(), 'name' => 'Tester',
            'email' => (string) Str::ulid().'@fixphone.test',
            'password' => Hash::make('secure-test-password'), 'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => $role]);
        Sanctum::actingAs($user);
    }

    private function catalog(): void
    {
        foreach ([
            ['id' => 'brand-apple', 'kind' => 'brands', 'payload' => ['id' => 'brand-apple', 'active' => true, 'name' => 'Apple']],
            ['id' => 'brand-samsung', 'kind' => 'brands', 'payload' => ['id' => 'brand-samsung', 'active' => true, 'name' => 'Samsung']],
            ['id' => 'model-iphone', 'kind' => 'deviceModels', 'payload' => ['id' => 'model-iphone', 'active' => true, 'name' => 'iPhone 12', 'brandId' => 'brand-apple']],
            ['id' => 'model-galaxy', 'kind' => 'deviceModels', 'payload' => ['id' => 'model-galaxy', 'active' => true, 'name' => 'Galaxy S21', 'brandId' => 'brand-samsung']],
        ] as $entry) {
            MasterDataEntry::query()->updateOrCreate(['kind' => $entry['kind'], 'id' => $entry['id']], ['payload' => $entry['payload']]);
        }
    }

    private function payload(): array
    {
        return [
            'name' => 'Pantalla OLED', 'brand_id' => 'brand-apple',
            'device_model_id' => 'model-iphone', 'initial_stock' => 4,
            'description' => 'Repuesto de pantalla',
        ];
    }

    public function test_create_requires_permission_and_active_matching_catalog(): void
    {
        $this->catalog();
        $path = '/api/v1/admin/inventory/spare-parts';
        $this->postJson($path, $this->payload())->assertUnauthorized();
        $this->signIn('intake_operator');
        $this->postJson($path, $this->payload())->assertForbidden();
        $this->signIn('owner');
        $this->postJson($path, [...$this->payload(), 'device_model_id' => 'model-galaxy'])
            ->assertUnprocessable()->assertJsonValidationErrors(['device_model_id']);
        $this->assertDatabaseCount('inventory_items', 0);
    }

    public function test_create_persists_stock_sku_catalog_and_audit(): void
    {
        $this->catalog();
        $this->signIn('owner');
        $created = $this->postJson('/api/v1/admin/inventory/spare-parts', $this->payload())
            ->assertCreated()->assertJsonPath('data.item_type', 'spare_part')
            ->assertJsonPath('data.stock_quantity', 4)
            ->assertJsonPath('data.brand', 'Apple')
            ->assertJsonPath('data.model', 'iPhone 12');
        $this->assertStringStartsWith('REP-', $created->json('data.sku'));
        $this->getJson('/api/v1/admin/inventory/items')
            ->assertOk()->assertJsonPath('data.0.brand_id', 'brand-apple')
            ->assertJsonPath('data.0.device_model_id', 'model-iphone');
        $this->assertDatabaseHas('audit_events', [
            'entity_id' => $created->json('data.id'),
            'event_type' => 'inventory.spare_part_created',
        ]);
        $updatePath = '/api/v1/admin/inventory/items/'.$created->json('data.id');
        $this->patchJson($updatePath, [
            'title' => 'Pantalla inválida', 'brand_id' => 'brand-samsung',
            'device_model_id' => 'model-iphone',
        ])->assertUnprocessable()->assertJsonValidationErrors(['device_model_id']);
        $this->patchJson($updatePath, [
            'title' => 'Pantalla revisada', 'brand_id' => 'brand-samsung',
            'device_model_id' => 'model-galaxy',
        ])->assertOk()->assertJsonPath('data.brand', 'Samsung')
            ->assertJsonPath('data.model', 'Galaxy S21')
            ->assertJsonPath('data.stock_quantity', 4);
        $this->assertDatabaseHas('inventory_items', [
            'id' => $created->json('data.id'), 'stock_quantity' => 4,
        ]);
    }
}
