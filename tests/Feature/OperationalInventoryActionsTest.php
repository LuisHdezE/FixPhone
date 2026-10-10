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

final class OperationalInventoryActionsTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsRole(string $role): void
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

    private function sparePart(int $stock = 4): InventoryItem
    {
        return InventoryItem::query()->create([
            'sku' => 'FP-BAT-IP11',
            'title' => 'Batería iPhone 11',
            'item_type' => 'spare_part',
            'brand' => 'Apple',
            'model' => 'iPhone 11',
            'description' => 'Batería para prueba',
            'operational_status' => 'en_stock',
            'publication_status' => 'no_publicable',
            'inventory_purpose' => 'sell_as_spare_part',
            'stock_quantity' => $stock,
            'metadata' => ['reorder_point' => 2],
        ]);
    }

    public function test_listing_is_real_and_never_includes_sample_stock(): void
    {
        $this->actingAsRole('owner');
        $this->getJson('/api/v1/admin/inventory/items')->assertOk()->assertJsonCount(0, 'data');
        $part = $this->sparePart();

        $this->getJson('/api/v1/admin/inventory/items')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $part->id)
            ->assertJsonPath('data.0.sku', 'FP-BAT-IP11')
            ->assertJsonPath('data.0.stock_quantity', 4)
            ->assertJsonPath('data.0.reorder_point', 2);

        $this->getJson('/api/v1/admin/inventory/items/'.$part->id)
            ->assertOk()->assertJsonPath('data.title', 'Batería iPhone 11');
    }

    public function test_operations_require_authentication_and_separate_permissions(): void
    {
        $part = $this->sparePart();
        $id = $part->id;

        $this->getJson('/api/v1/admin/inventory/items')->assertUnauthorized();
        $this->patchJson('/api/v1/admin/inventory/items/'.$id, ['title' => 'Nuevo'])->assertUnauthorized();
        $this->postJson('/api/v1/admin/inventory/items/'.$id.'/adjustments', [
            'request_id' => (string) Str::uuid(), 'delta' => 1, 'reason' => 'Corrección física',
        ])->assertUnauthorized();

        $this->actingAsRole('intake_operator');
        $this->getJson('/api/v1/admin/inventory/items')->assertOk();
        $this->getJson('/api/v1/admin/inventory/items/'.$id.'/adjustments')->assertOk();
        $this->patchJson('/api/v1/admin/inventory/items/'.$id, ['title' => 'No autorizado'])->assertForbidden();
        $this->postJson('/api/v1/admin/inventory/items/'.$id.'/adjustments', [
            'request_id' => (string) Str::uuid(), 'delta' => 1, 'reason' => 'Corrección física',
        ])->assertForbidden();

        $this->assertSame(4, $part->fresh()->stock_quantity);
    }

    public function test_catalog_edits_cannot_alter_stock_identifiers_or_publication(): void
    {
        $this->actingAsRole('owner');
        $part = $this->sparePart();
        $this->patchJson('/api/v1/admin/inventory/items/'.$part->id, [
            'title' => 'Batería revisada', 'description' => 'Descripción mejorada',
            'stock_quantity' => 888, 'sku' => 'CHANGED', 'publication_status' => 'publicado',
        ])->assertOk()->assertJsonPath('data.title', 'Batería revisada');

        $current = $part->fresh();
        $this->assertSame(4, $current->stock_quantity);
        $this->assertSame('FP-BAT-IP11', $current->sku);
        $this->assertSame('no_publicable', $current->publication_status);

        $this->assertDatabaseHas('audit_events', [
            'entity_id' => $part->id,
            'event_type' => 'inventory.catalog_updated',
        ]);
    }

    public function test_stock_adjustments_record_before_after_are_idempotent_and_cannot_go_negative(): void
    {
        $this->actingAsRole('owner');
        $part = $this->sparePart();
        $requestId = (string) Str::uuid();
        $payload = [
            'request_id' => $requestId,
            'delta' => -2,
            'reason' => 'Conteo físico de estantería',
        ];
        $url = '/api/v1/admin/inventory/items/'.$part->id.'/adjustments';

        $this->postJson($url, $payload)
            ->assertOk()
            ->assertJsonPath('data.stock_quantity', 2)
            ->assertJsonPath('replayed', false);

        $this->postJson($url, $payload)
            ->assertOk()
            ->assertJsonPath('data.stock_quantity', 2)
            ->assertJsonPath('replayed', true);
        $this->assertDatabaseCount('inventory_stock_adjustments', 1);

        $this->postJson($url, [
            ...$payload, 'delta' => -1,
        ])->assertUnprocessable()->assertJsonValidationErrors('request_id');

        $this->postJson($url, [
            'request_id' => (string) Str::uuid(), 'delta' => -3,
            'reason' => 'Corrección con stock insuficiente',
        ])->assertUnprocessable()->assertJsonValidationErrors('delta');

        $this->assertSame(2, $part->fresh()->stock_quantity);
        $this->getJson($url)->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.quantity_before', 4)
            ->assertJsonPath('data.0.quantity_delta', -2)
            ->assertJsonPath('data.0.quantity_after', 2)
            ->assertJsonPath('data.0.reason', 'Conteo físico de estantería');
        $this->assertDatabaseHas('audit_events', [
            'entity_id' => $part->id, 'event_type' => 'inventory.stock_adjusted',
        ]);
    }

    public function test_inventory_operator_can_adjust_but_cannot_edit_catalog(): void
    {
        $part = $this->sparePart();
        $this->actingAsRole('inventory_operator');

        $this->patchJson('/api/v1/admin/inventory/items/'.$part->id, [
            'title' => 'Editado sin permiso',
        ])->assertForbidden();

        $this->postJson('/api/v1/admin/inventory/items/'.$part->id.'/adjustments', [
            'request_id' => (string) Str::uuid(), 'delta' => 1,
            'reason' => 'Reconteo real de unidades',
        ])->assertOk()->assertJsonPath('data.stock_quantity', 5);
    }

    public function test_physical_device_stock_cannot_be_manually_adjusted(): void
    {
        $this->actingAsRole('owner');
        $device = InventoryItem::query()->create([
            'sku' => 'FXP-0100',
            'title' => 'iPhone 11 físico',
            'item_type' => 'used_phone',
            'operational_status' => 'ingresado',
            'publication_status' => 'no_publicable',
            'inventory_purpose' => 'parts_donor',
            'stock_quantity' => 1,
        ]);
        $this->postJson('/api/v1/admin/inventory/items/'.$device->id.'/adjustments', [
            'request_id' => (string) Str::uuid(), 'delta' => -1,
            'reason' => 'Intento de baja no autorizada',
        ])->assertUnprocessable()->assertJsonValidationErrors('delta');

        $this->assertSame(1, $device->fresh()->stock_quantity);
        $this->assertDatabaseCount('inventory_stock_adjustments', 0);
    }
}
