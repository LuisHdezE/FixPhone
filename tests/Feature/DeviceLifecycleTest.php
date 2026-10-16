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

final class DeviceLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private function signIn(string $role = 'owner'): void
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

    private function device(array $overrides = []): InventoryItem
    {
        return InventoryItem::query()->create(array_replace([
            'sku' => 'FXP-'.Str::ulid(),
            'title' => 'iPhone 11 de prueba',
            'brand' => 'Apple',
            'model' => 'iPhone 11',
            'item_type' => 'used_phone',
            'operational_status' => 'para_reparar',
            'inventory_purpose' => 'repair_then_sell',
            'publication_status' => 'no_publicable',
            'is_sellable' => false,
            'stock_quantity' => 1,
            'cost_amount_minor' => 250000,
            'sale_price_amount_minor' => null,
            'currency_code' => 'UYU',
            'dismantling_status' => 'not_started',
            'metadata' => ['destination' => 'Refurbish', 'powers_on' => 'Yes', 'account_lock' => 'Clear'],
        ], $overrides));
    }

    private function transition(InventoryItem $device, string $status, string $reason = 'Revisión del técnico en taller')
    {
        return $this->patchJson('/api/v1/admin/inventory/'.$device->id.'/lifecycle', compact('status', 'reason'));
    }

    public function test_authentication_and_roles_protect_status_write_and_history(): void
    {
        $device = $this->device();
        $this->getJson('/api/v1/admin/inventory/'.$device->id.'/lifecycle')->assertUnauthorized();
        $this->transition($device, 'en_reparacion')->assertUnauthorized();

        $this->signIn('intake_operator');
        $this->getJson('/api/v1/admin/inventory/'.$device->id.'/lifecycle')->assertOk();
        $this->transition($device, 'en_reparacion')->assertForbidden();
        $this->assertSame('para_reparar', $device->fresh()->operational_status);
    }

    public function test_reaconditioning_to_sale_ready_preserves_initial_purpose_and_money(): void
    {
        $this->signIn();
        $device = $this->device();

        $this->transition($device, 'en_reparacion')->assertOk()->assertJsonPath('data.operational_status', 'en_reparacion');
        $this->transition($device, 'reparado')->assertOk();
        $this->transition($device, 'listo_para_venta')->assertOk();
        $fresh = $device->fresh();

        $this->assertSame('Refurbish', $fresh->metadata['destination']);
        $this->assertSame('FXP-', substr($fresh->sku, 0, 4));
        $this->assertSame('repair_then_sell', $fresh->inventory_purpose);
        $this->assertSame('listo_para_venta', $fresh->operational_status);
        $this->assertSame(1, $fresh->stock_quantity);
        $this->assertSame(250000, $fresh->cost_amount_minor);
        $this->assertNull($fresh->sale_price_amount_minor);
        $this->assertFalse($fresh->is_sellable);
        $this->assertSame('no_publicable', $fresh->publication_status);
        $this->assertDatabaseCount('device_sale_records', 0);

        $this->getJson('/api/v1/admin/inventory/'.$device->id.'/lifecycle')->assertOk()
            ->assertJsonPath('data.current_destination', 'Refurbish')
            ->assertJsonPath('data.operational_status', 'listo_para_venta')
            ->assertJsonPath('data.history.0.from_status', 'reparado')
            ->assertJsonPath('data.history.0.to_status', 'listo_para_venta')
            ->assertJsonPath('data.history.0.reason', 'Revisión del técnico en taller')
            ->assertJsonCount(3, 'data.history');
        $this->assertDatabaseHas('audit_events', [
            'entity_id' => $device->id, 'event_type' => 'inventory.device_status_changed',
        ]);
    }

    public function test_destination_changes_use_existing_routing_instead_of_a_second_state_machine(): void
    {
        $this->signIn();
        $device = $this->device();
        $this->transition($device, 'para_deshuesar')->assertStatus(409);
        $this->assertSame('repair_then_sell', $device->fresh()->inventory_purpose);
        $this->patchJson('/api/v1/admin/inventory/'.$device->id.'/routing', [
            'destination' => 'Donor', 'reason' => 'Se confirma como donante de piezas',
        ])->assertOk();
        $this->assertSame('parts_donor', $device->fresh()->inventory_purpose);
        $this->assertSame('Donor', $device->fresh()->metadata['destination']);
        $this->getJson('/api/v1/admin/inventory/'.$device->id.'/lifecycle')->assertOk()
            ->assertJsonPath('data.current_destination', 'Donor')->assertJsonPath('data.allowed_statuses', []);
    }

    public function test_dismantling_partial_prevents_reclassification(): void
    {
        $this->signIn();
        $device = $this->device(['operational_status' => 'para_deshuesar', 'inventory_purpose' => 'parts_donor', 'dismantling_status' => 'partial']);

        $this->getJson('/api/v1/admin/inventory/'.$device->id.'/lifecycle')
            ->assertOk()->assertJsonPath('data.allowed_statuses', []);
        $this->transition($device, 'para_reparar')->assertStatus(409);
        $this->assertSame('parts_donor', $device->fresh()->inventory_purpose);
    }

    public function test_publication_orders_and_sales_block_lifecycle_changes(): void
    {
        $this->signIn();
        $device = $this->device(['is_sellable' => true]);
        $this->transition($device, 'en_reparacion')->assertStatus(409);

        $device->is_sellable = false;
        $device->publication_status = 'publicado';
        $device->save();
        $this->transition($device, 'en_reparacion')->assertStatus(409);

        $device->publication_status = 'no_publicable';
        $device->save();
        $customerId = (string) Str::ulid();
        DB::table('crm_customers')->insert([
            'id' => $customerId, 'full_name' => 'Cliente', 'relationship_state' => 'active',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $orderId = (string) Str::ulid();
        DB::table('orders')->insert([
            'id' => $orderId, 'order_number' => 'FP-LIFECYCLE',
            'customer_id' => $customerId, 'customer_name_snapshot' => 'Cliente',
            'created_by_actor_id' => 'owner', 'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('order_items')->insert([
            'id' => (string) Str::ulid(), 'order_id' => $orderId,
            'inventory_item_id' => $device->id, 'item_name_snapshot' => $device->title,
            'item_type_snapshot' => 'used_phone', 'quantity' => 1, 'unit_price_minor' => 100000,
            'line_total_minor' => 100000, 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->transition($device, 'en_reparacion')->assertStatus(409);
        $this->assertSame('para_reparar', $device->fresh()->operational_status);
        DB::table('orders')->where('id', $orderId)->update(['status' => 'cancelled']);
        $this->transition($device, 'en_reparacion')->assertOk();

        $device->operational_status = 'vendido';
        $device->save();
        $this->transition($device, 'reparado')->assertStatus(409);
    }

    public function test_ready_requires_basic_power_and_account_checks(): void
    {
        $this->signIn();
        $device = $this->device([
            'operational_status' => 'reparado',
            'metadata' => ['destination' => 'Pending Evaluation', 'powers_on' => 'Unknown', 'account_lock' => 'Locked'],
        ]);
        $this->getJson('/api/v1/admin/inventory/'.$device->id.'/lifecycle')->assertOk()
            ->assertJsonMissing(['listo_para_venta']);
        $this->transition($device, 'listo_para_venta')->assertStatus(409);
        $this->assertSame('reparado', $device->fresh()->operational_status);
    }

    public function test_consignor_ownership_is_not_reclassified_as_donor_or_discard(): void
    {
        $this->signIn();
        $device = $this->device(['inventory_purpose' => 'consigned_phone']);
        $this->transition($device, 'para_deshuesar')->assertStatus(409);
        $this->transition($device, 'descartado')->assertStatus(409);
        $this->transition($device, 'en_reparacion')->assertOk();
        $this->assertSame('consigned_phone', $device->fresh()->inventory_purpose);
    }

    public function test_invalid_transitions_and_forged_fields_leave_all_values_untouched(): void
    {
        $this->signIn();
        $device = $this->device();
        $url = '/api/v1/admin/inventory/'.$device->id.'/lifecycle';
        $this->transition($device, 'listo_para_venta')->assertStatus(409);
        $this->transition($device, 'en_reparacion', 'abc')->assertUnprocessable()->assertJsonValidationErrors(['reason']);
        $this->patchJson($url, ['status' => 'en_reparacion', 'reason' => 'Intento de modificar destino', 'metadata' => ['destination' => 'Donor']])
            ->assertUnprocessable();
        $this->patchJson($url, ['status' => 'vendido', 'reason' => 'Venta simulada en estado'])
            ->assertUnprocessable();
        $this->assertSame('Refurbish', $device->fresh()->metadata['destination']);
        $this->assertSame('para_reparar', $device->fresh()->operational_status);
        $this->assertDatabaseCount('audit_events', 0);
    }
}
