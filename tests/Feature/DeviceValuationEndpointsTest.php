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

final class DeviceValuationEndpointsTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsRole(string $role): void
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => 'Test',
            'email' => $role.'@example.test',
            'password' => Hash::make('secret-password'),
            'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => $role]);
        Sanctum::actingAs($user);
    }

    private function payload(): array
    {
        return [
            'model_name' => 'iPhone 11 Pro',
            'fault_type' => 'icloud',
            'screen_condition' => 'good',
            'power_state' => 'yes',
            'estimated_min_minor' => 270000,
            'estimated_max_minor' => 400000,
            'asking_price_minor' => 450000,
            'minimum_price_minor' => 320000,
            'publication_status' => 'draft',
            'facebook_copy' => 'FixPhone: iPhone 11 Pro bloqueado por iCloud, solo repuestos.',
        ];
    }

    public function test_authentication_and_valuation_permission_are_required(): void
    {
        $this->getJson('/api/v1/admin/valuations')->assertUnauthorized();
        $this->postJson('/api/v1/admin/valuations', $this->payload())->assertUnauthorized();

        $this->actingAsRole('technician');
        $this->getJson('/api/v1/admin/valuations')->assertForbidden();
        $this->postJson('/api/v1/admin/valuations', $this->payload())->assertForbidden();
    }

    public function test_sales_operator_can_create_read_and_update_single_device_valuation(): void
    {
        $this->actingAsRole('sales_operator');
        $created = $this->postJson('/api/v1/admin/valuations', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.model_name', 'iPhone 11 Pro')
            ->assertJsonPath('data.asking_price_minor', 450000);

        $id = $created->json('data.id');
        $this->getJson('/api/v1/admin/valuations')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $id);

        $this->patchJson('/api/v1/admin/valuations/'.$id, [
            'publication_status' => 'published',
            'facebook_post_url' => 'https://www.facebook.com/marketplace/item/1234567',
        ])->assertOk()->assertJsonPath('data.publication_status', 'published');

        $this->assertDatabaseHas('device_valuations', ['id' => $id, 'asking_price_minor' => 450000]);
        $this->assertDatabaseHas('audit_events', ['entity_id' => $id, 'event_type' => 'VALUATION.CREATED']);
        $this->assertDatabaseHas('audit_events', ['entity_id' => $id, 'event_type' => 'VALUATION.UPDATED']);
    }

    public function test_invalid_prices_and_publication_without_price_are_rejected(): void
    {
        $this->actingAsRole('owner');

        $this->postJson('/api/v1/admin/valuations', array_merge($this->payload(), [
            'estimated_min_minor' => 900000,
        ]))->assertUnprocessable();

        $this->postJson('/api/v1/admin/valuations', array_merge($this->payload(), [
            'minimum_price_minor' => 999999,
        ]))->assertUnprocessable();

        $this->postJson('/api/v1/admin/valuations', array_merge($this->payload(), [
            'publication_status' => 'published',
            'asking_price_minor' => null,
        ]))->assertUnprocessable();
    }

    public function test_optional_link_to_real_inventory_does_not_duplicate_device_or_publish_it(): void
    {
        $this->actingAsRole('owner');
        $device = InventoryItem::query()->create([
            'title' => 'iPhone 12', 'item_type' => 'used_phone', 'brand' => 'Apple',
            'model' => 'iPhone 12', 'operational_status' => 'ingresado',
            'publication_status' => 'no_publicable', 'inventory_purpose' => 'parts_donor',
        ]);

        $this->postJson('/api/v1/admin/valuations', array_merge($this->payload(), [
            'model_name' => 'iPhone 12',
            'inventory_item_id' => $device->id,
        ]))->assertCreated()->assertJsonPath('data.inventory_item_id', $device->id);

        $this->assertSame(1, InventoryItem::query()->count());
        $this->assertSame('no_publicable', $device->fresh()->publication_status);
        $this->assertDatabaseCount('device_valuations', 1);
    }
}

