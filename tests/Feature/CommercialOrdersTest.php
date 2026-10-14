<?php

namespace Tests\Feature;

use App\Infrastructure\Customer\Customer;
use App\Infrastructure\Identity\User;
use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class CommercialOrdersTest extends TestCase
{
    use RefreshDatabase;

    private function signIn(string $role = 'sales_operator'): void
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

    private function customer(): Customer
    {
        return Customer::query()->create([
            'full_name' => 'Cliente registrado',
            'phone' => '098765432',
            'relationship_state' => 'active',
        ]);
    }

    private function item(array $overrides = []): InventoryItem
    {
        return InventoryItem::query()->create(array_merge([
            'sku' => 'FXP-'.strtoupper((string) Str::ulid()),
            'title' => 'iPhone 12 usado',
            'item_type' => 'used_phone',
            'brand' => 'Apple',
            'operational_status' => 'en_stock',
            'publication_status' => 'no_publicable',
            'inventory_purpose' => 'sell_as_used_phone',
            'is_sellable' => true,
            'stock_quantity' => 1,
            'cost_amount_minor' => 200000,
            'sale_price_amount_minor' => 490000,
            'currency_code' => 'UYU',
            'metadata' => [],
        ], $overrides));
    }

    private function requestBody(Customer $customer, InventoryItem $item, int $quantity = 1): array
    {
        return [
            'customer_id' => $customer->id,
            'notes' => 'Reservar para retiro',
            'items' => [['inventory_item_id' => $item->id, 'quantity' => $quantity]],
        ];
    }

    public function test_unauthenticated_cannot_read_or_create_orders(): void
    {
        $this->getJson('/api/v1/admin/orders')->assertUnauthorized();
        $this->getJson('/api/v1/admin/orders/catalog')->assertUnauthorized();
        $this->postJson('/api/v1/admin/orders', [])->assertUnauthorized();
    }

    public function test_order_permissions_match_sales_roles(): void
    {
        $customer = $this->customer();
        $item = $this->item();
        $this->signIn('intake_operator');
        $this->getJson('/api/v1/admin/orders')->assertForbidden();
        $this->postJson('/api/v1/admin/orders', $this->requestBody($customer, $item))->assertForbidden();
    }

    public function test_create_update_advance_and_cancel_keep_stock_and_sales_untouched(): void
    {
        $this->signIn();
        $customer = $this->customer();
        $device = $this->item();
        $spare = $this->item([
            'title' => 'Pantalla iPhone 12', 'item_type' => 'spare_part',
            'stock_quantity' => 5, 'sale_price_amount_minor' => 90000,
        ]);

        $created = $this->postJson('/api/v1/admin/orders', $this->requestBody($customer, $device))
            ->assertCreated()->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.total_amount_minor', 490000)
            ->assertJsonCount(1, 'data.items')->json('data');

        $id = $created['id'];
        $this->assertStringStartsWith('FP-', $created['number']);
        $this->getJson('/api/v1/admin/orders')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/admin/orders/'.$id)->assertOk()->assertJsonPath('data.customer_name', 'Cliente registrado');

        $this->patchJson('/api/v1/admin/orders/'.$id, [
            'customer_id' => $customer->id,
            'notes' => 'Agregar pantalla',
            'items' => [
                ['inventory_item_id' => $device->id, 'quantity' => 1],
                ['inventory_item_id' => $spare->id, 'quantity' => 2],
            ],
        ])->assertOk()->assertJsonPath('data.total_amount_minor', 670000)->assertJsonCount(2, 'data.items');

        $this->patchJson('/api/v1/admin/orders/'.$id.'/status', ['status' => 'processing'])->assertOk()->assertJsonPath('data.status', 'processing');
        $this->patchJson('/api/v1/admin/orders/'.$id.'/status', ['status' => 'ready'])->assertOk()->assertJsonPath('data.status', 'ready');
        $this->patchJson('/api/v1/admin/orders/'.$id.'/status', [
            'status' => 'cancelled', 'reason' => 'El cliente desistió',
        ])->assertOk()->assertJsonPath('data.status', 'cancelled')
          ->assertJsonPath('data.cancel_reason', 'El cliente desistió');

        $this->assertSame(1, $device->fresh()->stock_quantity);
        $this->assertSame(5, $spare->fresh()->stock_quantity);
        $this->assertDatabaseCount('device_sale_records', 0);
        $this->assertDatabaseHas('audit_events', ['entity_id' => $id, 'event_type' => 'orders.created']);
        $this->assertDatabaseHas('audit_events', ['entity_id' => $id, 'event_type' => 'orders.updated']);
        $this->assertDatabaseHas('audit_events', ['entity_id' => $id, 'event_type' => 'orders.status_changed']);
    }

    public function test_stock_commitments_prevent_double_ordering_and_cancel_releases(): void
    {
        $this->signIn();
        $customer = $this->customer();
        $device = $this->item();
        $first = $this->postJson('/api/v1/admin/orders', $this->requestBody($customer, $device))->assertCreated()->json('data.id');

        $this->postJson('/api/v1/admin/orders', $this->requestBody($customer, $device))->assertStatus(409);
        $this->getJson('/api/v1/admin/orders/catalog')->assertOk()->assertJsonMissing(['id' => $device->id]);
        $this->getJson('/api/v1/admin/orders/catalog?order_id='.$first)->assertOk()->assertJsonFragment(['id' => $device->id]);
        $this->patchJson('/api/v1/admin/orders/'.$first.'/status', [
            'status' => 'cancelled', 'reason' => 'Cliente cambió de idea',
        ])->assertOk();
        $this->postJson('/api/v1/admin/orders', $this->requestBody($customer, $device))->assertCreated();
    }

    public function test_server_ignores_no_client_prices_and_rejects_fakes(): void
    {
        $this->signIn();
        $customer = $this->customer();
        $item = $this->item();

        $this->postJson('/api/v1/admin/orders', [
            ...$this->requestBody($customer, $item), 'total_amount_minor' => 1,
        ])->assertUnprocessable()->assertJsonValidationErrors(['order']);

        $this->postJson('/api/v1/admin/orders', [
            ...$this->requestBody($customer, $item),
            'items' => [['inventory_item_id' => $item->id, 'quantity' => 1, 'unit_price_minor' => 1]],
        ])->assertUnprocessable()->assertJsonValidationErrors(['items.0']);

        $fake = $this->item(['metadata' => ['is_mvp_demo' => true]]);
        $this->postJson('/api/v1/admin/orders', $this->requestBody($customer, $fake))->assertUnprocessable();

        $sold = $this->item(['operational_status' => 'vendido']);
        $this->postJson('/api/v1/admin/orders', $this->requestBody($customer, $sold))->assertUnprocessable();

        $this->postJson('/api/v1/admin/orders', $this->requestBody($customer, $item, 2))->assertUnprocessable();
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_direct_sale_cannot_bypass_open_order_reservation(): void
    {
        $this->signIn('owner');
        $customer = $this->customer();
        $device = $this->item();
        $orderId = $this->postJson('/api/v1/admin/orders', $this->requestBody($customer, $device))
            ->assertCreated()->json('data.id');

        $salePayload = [
            'request_id' => (string) Str::uuid(),
            'effective_sale_price_minor' => 490000,
            'notes' => 'Venta directa de prueba',
        ];

        $this->postJson('/api/v1/admin/devices/'.$device->id.'/sell', $salePayload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['effective_sale_price_minor']);
        $this->assertDatabaseCount('device_sale_records', 0);
        $this->assertSame('en_stock', $device->fresh()->operational_status);

        $this->patchJson('/api/v1/admin/orders/'.$orderId.'/status', [
            'status' => 'cancelled',
            'reason' => 'Se cancela la reserva comercial',
        ])->assertOk();

        $this->postJson('/api/v1/admin/devices/'.$device->id.'/sell', $salePayload)
            ->assertCreated();
        $this->assertDatabaseCount('device_sale_records', 1);
        $this->assertSame('vendido', $device->fresh()->operational_status);
    }

    public function test_invalid_transitions_and_edits_after_preparing_are_blocked(): void
    {
        $this->signIn();
        $customer = $this->customer();
        $device = $this->item();
        $id = $this->postJson('/api/v1/admin/orders', $this->requestBody($customer, $device))->assertCreated()->json('data.id');

        $this->patchJson('/api/v1/admin/orders/'.$id.'/status', ['status' => 'ready'])->assertStatus(409);
        $this->patchJson('/api/v1/admin/orders/'.$id.'/status', ['status' => 'completed'])->assertUnprocessable();
        $this->patchJson('/api/v1/admin/orders/'.$id.'/status', ['status' => 'cancelled'])->assertUnprocessable();
        $this->patchJson('/api/v1/admin/orders/'.$id.'/status', ['status' => 'processing'])->assertOk();
        $this->patchJson('/api/v1/admin/orders/'.$id, $this->requestBody($customer, $device))->assertStatus(409);
        $this->assertDatabaseCount('device_sale_records', 0);
    }

    public function test_mixed_currency_and_insufficient_stock_rejected(): void
    {
        $this->signIn();
        $customer = $this->customer();
        $device = $this->item();
        $usd = $this->item(['item_type' => 'spare_part', 'stock_quantity' => 2, 'currency_code' => 'USD']);
        $this->postJson('/api/v1/admin/orders', [
            'customer_id' => $customer->id,
            'items' => [
                ['inventory_item_id' => $device->id, 'quantity' => 1],
                ['inventory_item_id' => $usd->id, 'quantity' => 1],
            ],
        ])->assertUnprocessable()->assertJsonValidationErrors(['items']);
        $this->assertDatabaseCount('orders', 0);
    }
}
