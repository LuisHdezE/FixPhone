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

final class DeviceRoutingTest extends TestCase
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
        return InventoryItem::query()->create(array_merge([
            'sku' => 'FXP-ROUTE-'.strtoupper(substr((string) Str::ulid(), -12)),
            'title' => 'iPhone 12',
            'item_type' => 'used_phone',
            'brand' => 'Apple',
            'model' => 'iPhone 12',
            'inventory_purpose' => 'internal_use',
            'operational_status' => 'ingresado',
            'publication_status' => 'no_publicable',
            'is_sellable' => false,
            'stock_quantity' => 1,
            'dismantling_status' => 'not_started',
            'cost_amount_minor' => 210000,
            'sale_price_amount_minor' => null,
            'currency_code' => 'UYU',
            'metadata' => ['destination' => 'Pending Evaluation', 'serial_or_imei' => 'TEST123'],
        ], $overrides));
    }

    private function path(InventoryItem $device): string
    {
        return '/api/v1/admin/inventory/'.$device->id.'/routing';
    }

    private function payload(string $destination = 'Refurbish'): array
    {
        return [
            'destination' => $destination,
            'reason' => 'Diagnóstico completado por el técnico, requiere reparación.',
        ];
    }

    public function test_route_is_authenticated_and_requires_specific_permission(): void
    {
        $device = $this->device();
        $this->patchJson($this->path($device), $this->payload())->assertUnauthorized();
        $this->signIn('technician');
        $this->patchJson($this->path($device), $this->payload())->assertForbidden();
        $this->signIn('owner');
        $this->patchJson($this->path($device), $this->payload())->assertOk();
    }

    public function test_change_destination_updates_real_fields_and_audit_without_touching_finance(): void
    {
        $this->signIn();
        $device = $this->device();
        $this->patchJson($this->path($device), $this->payload('Donor'))
            ->assertOk()
            ->assertJsonPath('data.destination', 'Donor')
            ->assertJsonPath('data.inventory_purpose', 'parts_donor')
            ->assertJsonPath('data.operational_status', 'para_deshuesar');

        $device->refresh();
        $this->assertSame('Donor', $device->metadata['destination']);
        $this->assertSame(1, $device->stock_quantity);
        $this->assertSame(210000, $device->cost_amount_minor);
        $this->assertFalse($device->is_sellable);
        $this->assertSame('no_publicable', $device->publication_status);
        $this->assertDatabaseCount('device_sale_records', 0);
        $this->assertDatabaseHas('audit_events', [
            'entity_id' => $device->id,
            'event_type' => 'inventory.device_destination_changed',
        ]);
    }

    public function test_changing_destination_remains_possible_after_a_saved_technical_evaluation(): void
    {
        $this->signIn();
        $device = $this->device();
        DB::table('device_technical_evaluations')->insert([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $device->id,
            'revision' => 1,
            'request_id' => (string) Str::uuid(),
            'device_sku_snapshot' => $device->sku,
            'device_title_snapshot' => $device->title,
            'overall_result' => 'partial',
            'evaluated_by_actor_id' => (string) auth()->id(),
            'technician_name_snapshot' => 'Owner',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->patchJson($this->path($device), $this->payload())
            ->assertOk()->assertJsonPath('data.destination', 'Refurbish');
        $this->assertDatabaseCount('device_technical_evaluations', 1);
        $this->assertSame('para_reparar', $device->fresh()->operational_status);
    }

    public function test_guardrails_prevent_sales_publications_and_advanced_dismantling(): void
    {
        $this->signIn();
        $sold = $this->device(['operational_status' => 'vendido', 'metadata' => ['destination' => 'Donor']]);
        $this->patchJson($this->path($sold), $this->payload('Hold'))->assertStatus(409);

        $listed = $this->device(['is_sellable' => true, 'publication_status' => 'publicado']);
        $this->patchJson($this->path($listed), $this->payload())->assertStatus(409);

        $availableButUnlisted = $this->device(['is_sellable' => true]);
        $this->patchJson($this->path($availableButUnlisted), $this->payload())->assertOk();
        $this->assertFalse($availableButUnlisted->fresh()->is_sellable);

        $dismantled = $this->device([
            'inventory_purpose' => 'parts_donor',
            'dismantling_status' => 'partial',
            'metadata' => ['destination' => 'Donor'],
        ]);
        $this->patchJson($this->path($dismantled), $this->payload('Refurbish'))->assertStatus(409);

        $consigned = $this->device(['inventory_purpose' => 'consignation']);
        $this->patchJson($this->path($consigned), $this->payload('Discard'))->assertStatus(409);
    }

    public function test_open_commercial_order_prevents_rerouting(): void
    {
        $this->signIn();
        $device = $this->device();
        $customerId = (string) Str::ulid();
        DB::table('crm_customers')->insert([
            'id' => $customerId, 'full_name' => 'Cliente de pedido', 'phone' => '098123456',
            'relationship_state' => 'active', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $orderId = (string) Str::ulid();
        DB::table('orders')->insert([
            'id' => $orderId, 'order_number' => 'FP-ROUTING-TEST',
            'customer_id' => $customerId, 'customer_name_snapshot' => 'Cliente de pedido',
            'status' => 'pending', 'created_by_actor_id' => (string) auth()->id(),
            'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('order_items')->insert([
            'id' => (string) Str::ulid(), 'order_id' => $orderId,
            'inventory_item_id' => $device->id, 'item_name_snapshot' => 'iPhone 12',
            'item_type_snapshot' => 'used_phone', 'quantity' => 1,
            'unit_price_minor' => 250000, 'line_total_minor' => 250000,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->patchJson($this->path($device), $this->payload())->assertStatus(409);
        $this->assertSame('Pending Evaluation', $device->fresh()->metadata['destination']);
    }

    public function test_validations_reject_invalid_route_fake_fields_and_noop(): void
    {
        $this->signIn();
        $device = $this->device();
        $this->patchJson($this->path($device), $this->payload('sold'))
            ->assertUnprocessable()->assertJsonValidationErrors(['destination']);
        $this->patchJson($this->path($device), ['destination' => 'Donor', 'reason' => 'corto'])
            ->assertUnprocessable()->assertJsonValidationErrors(['reason']);
        $this->patchJson($this->path($device), [...$this->payload(), 'sale_price_amount_minor' => 1])
            ->assertUnprocessable()->assertJsonValidationErrors(['destination']);
        $this->patchJson($this->path($device), $this->payload('Pending Evaluation'))
            ->assertUnprocessable()->assertJsonValidationErrors(['destination']);
        $this->assertSame('ingresado', $device->fresh()->operational_status);
        $this->assertDatabaseMissing('audit_events', [
            'entity_id' => $device->id, 'event_type' => 'inventory.device_destination_changed',
        ]);
    }
}
