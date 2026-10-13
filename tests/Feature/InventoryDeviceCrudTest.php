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

final class InventoryDeviceCrudTest extends TestCase
{
    use RefreshDatabase;

    private function signIn(string $role): void
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => $role,
            'email' => (string) Str::ulid().'@fixphone.test',
            'password' => Hash::make('test-password'),
            'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => $role]);
        Sanctum::actingAs($user);
    }

    private function device(array $attributes = []): InventoryItem
    {
        return InventoryItem::query()->create(array_merge([
            'sku' => 'FXP-9001',
            'title' => 'iPhone 11',
            'item_type' => 'used_phone',
            'brand' => 'Apple',
            'model' => 'iPhone 11',
            'operational_status' => 'ingresado',
            'publication_status' => 'no_publicable',
            'inventory_purpose' => 'internal_use',
            'stock_quantity' => 1,
            'cost_amount_minor' => 300000,
            'currency_code' => 'UYU',
            'metadata' => ['origin_marker' => 'preservar', 'serial_or_imei' => 'OLD', 'device_model_id' => 'OLDID', 'condition_id' => 'OLDCONDITION'],
        ], $attributes));
    }

    private function updatePayload(): array
    {
        return [
            'title' => 'iPhone 11 Pro',
            'brand' => 'Apple',
            'model' => 'iPhone 11 Pro',
            'description' => 'Equipo revisado',
            'serial_or_imei' => 'NEW123',
            'storage' => '128 GB',
            'color' => 'Azul',
            'physical_condition' => 'Good',
            'powers_on' => 'Yes',
            'account_lock' => 'Clear',
            'acquisition_source' => 'Compra directa',
            'cost_amount_minor' => 350000,
            'currency_code' => 'UYU',
        ];
    }

    public function test_device_crud_requires_authentication_and_catalog_permission(): void
    {
        $device = $this->device();
        $path = '/api/v1/admin/inventory/'.$device->id;
        $this->patchJson($path, $this->updatePayload())->assertUnauthorized();
        $this->deleteJson($path)->assertUnauthorized();

        $this->signIn('intake_operator');
        $this->getJson('/api/v1/admin/inventory')->assertOk();
        $this->patchJson($path, $this->updatePayload())->assertForbidden();
        $this->deleteJson($path)->assertForbidden();
        $this->assertDatabaseHas('inventory_items', ['id' => $device->id, 'deleted_at' => null]);
    }

    public function test_owner_can_edit_only_device_fields_with_auditable_history(): void
    {
        $this->signIn('owner');
        $device = $this->device();
        $path = '/api/v1/admin/inventory/'.$device->id;

        $this->patchJson($path, $this->updatePayload())->assertOk()
            ->assertJsonPath('data.title', 'iPhone 11 Pro')
            ->assertJsonPath('data.metadata.serial_or_imei', 'NEW123')
            ->assertJsonPath('data.metadata.origin_marker', 'preservar');
            $this->assertNull($device->fresh()->metadata['device_model_id']);
            $this->assertNull($device->fresh()->metadata['condition_id']);

        $fresh = $device->fresh();
        $this->assertSame('FXP-9001', $fresh->sku);
        $this->assertSame(1, $fresh->stock_quantity);
        $this->assertSame(350000, $fresh->cost_amount_minor);
        $this->assertDatabaseHas('audit_events', [
            'entity_id' => $device->id,
            'event_type' => 'inventory.device_updated',
            'action' => 'update',
        ]);

        $this->patchJson($path, [...$this->updatePayload(), 'sku' => 'FXP-9999'])
            ->assertUnprocessable();
        $this->assertSame('FXP-9001', $device->fresh()->sku);
    }

    public function test_delete_is_logical_and_keeps_permanent_device_code_and_audit(): void
    {
        $this->signIn('owner');
        $device = $this->device();
        $this->deleteJson('/api/v1/admin/inventory/'.$device->id)->assertOk();
        $this->assertSoftDeleted('inventory_items', ['id' => $device->id, 'sku' => 'FXP-9001']);
        $this->assertDatabaseHas('audit_events', [
            'entity_id' => $device->id,
            'event_type' => 'inventory.device_archived',
            'action' => 'delete',
        ]);
        $this->getJson('/api/v1/admin/inventory')->assertOk()->assertJsonCount(0, 'data');
        $this->assertSame('FXP-9001', InventoryItem::withTrashed()->findOrFail($device->id)->sku);
        $this->deleteJson('/api/v1/admin/inventory/'.$device->id)->assertNotFound();
    }

    public function test_delete_refuses_devices_with_part_history_or_publication(): void
    {
        $this->signIn('owner');
        $device = $this->device();
        DB::table('device_installed_parts')->insert([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $device->id,
            'part_name' => 'Pantalla',
            'cost_amount_minor' => 50000,
            'currency_code' => 'UYU',
            'installed_at' => now(),
            'installed_by_actor_id' => 'owner',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $path = '/api/v1/admin/inventory/'.$device->id;
        $this->deleteJson($path)->assertStatus(409);
        $this->patchJson($path, $this->updatePayload())->assertStatus(409);
        $this->assertDatabaseHas('inventory_items', ['id' => $device->id, 'deleted_at' => null]);
        DB::table('device_installed_parts')->where('inventory_item_id', $device->id)->delete();

        $device->publication_status = 'publicado';
        $device->save();
        $this->deleteJson($path)->assertStatus(409);
        $this->assertDatabaseHas('inventory_items', ['id' => $device->id, 'deleted_at' => null]);
    }

    public function test_other_item_types_are_rejected(): void
    {
        $this->signIn('owner');
        $item = $this->device(['item_type' => 'spare_part']);
        $path = '/api/v1/admin/inventory/'.$item->id;
        $this->deleteJson($path)->assertStatus(422);
        $this->patchJson($path, $this->updatePayload())->assertStatus(422);
    }
}
