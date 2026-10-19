<?php

namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class StorefrontCheckoutOrderTest extends TestCase
{
    use RefreshDatabase;

    private function customer(): User
    {
        return User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => 'Cliente FixPhone',
            'email' => Str::ulid().'@example.test',
            'password' => Hash::make('secret-password'),
            'active' => true,
        ]);
    }

    private function test_part(int $stock = 1): InventoryItem
    {
        return InventoryItem::query()->create([
            'sku' => 'REP-0042',
            'title' => 'Bateria Samsung SM-A325M recuperada original',
            'item_type' => 'spare_part',
            'brand' => 'Samsung',
            'model' => 'SM-A325M',
            'operational_status' => 'en_stock',
            'publication_status' => 'publicado',
            'inventory_purpose' => 'sell_as_spare_part',
            'is_sellable' => true,
            'stock_quantity' => $stock,
            'sale_price_amount_minor' => 1000,
            'currency_code' => 'UYU',
            'metadata' => ['origin' => 'recovered', 'part_condition' => 'functional', 'is_original' => true],
        ]);
    }

    private function addToCart(User $user, InventoryItem $item, int $quantity = 1): void
    {
        Sanctum::actingAs($user);
        $this->postJson('/api/v1/store/cart', [
            'product_id' => $item->id,
            'quantity' => $quantity,
        ])->assertOk();
    }

    public function test_checkout_creates_authoritative_internal_order_without_calling_payment_provider(): void
    {
        Http::fake();
        $user = $this->customer();
        $item = $this->testPart();
        $this->addToCart($user, $item);

        $response = $this->postJson('/api/v1/store/checkout', [
            'items' => [['product_id' => 'forged-id', 'quantity' => 999, 'unit_price_minor' => 1]],
            'total_amount_minor' => 1,
            'user_id' => 'another-user',
        ], ['Idempotency-Key' => 'fpstore_checkout_attempt_0001'])
            ->assertCreated()
            ->assertJsonPath('data.status', 'awaiting_payment')
            ->assertJsonPath('data.total_amount_minor', 1000)
            ->assertJsonPath('data.currency_code', 'UYU')
            ->assertJsonPath('data.payment_initiated', false)
            ->assertJsonPath('data.next_step', 'payment_provider');

        $orderId = $response->json('data.id');
        $this->assertDatabaseHas('storefront_orders', [
            'id' => $orderId,
            'user_id' => $user->id,
            'customer_email' => $user->email,
            'status' => 'awaiting_payment',
            'total_amount_minor' => 1000,
            'currency_code' => 'UYU',
            'external_reference' => 'FPSTORE-'.$orderId,
        ]);
        $this->assertDatabaseHas('storefront_order_items', [
            'order_id' => $orderId,
            'inventory_item_id' => $item->id,
            'sku_snapshot' => 'REP-0042',
            'quantity' => 1,
            'unit_price_minor' => 1000,
            'line_total_minor' => 1000,
        ]);
        $this->assertSame(1, $item->fresh()->stock_quantity);
        $this->assertDatabaseCount('storefront_cart_lines', 1);
        Http::assertNothingSent();
    }

    public function test_checkout_requires_authentication_and_a_valid_idempotency_key(): void
    {
        $this->postJson('/api/v1/store/checkout')->assertUnauthorized();

        $user = $this->customer();
        $item = $this->testPart();
        $this->addToCart($user, $item);

        $this->postJson('/api/v1/store/checkout')->assertUnprocessable()
            ->assertJsonValidationErrors('idempotency_key');
        $this->postJson('/api/v1/store/checkout', [], ['Idempotency-Key' => 'bad key'])
            ->assertUnprocessable()->assertJsonValidationErrors('idempotency_key');

        $this->assertDatabaseCount('storefront_orders', 0);
    }

    public function test_checkout_is_idempotent_and_reuses_the_same_open_order_for_the_same_cart(): void
    {
        Http::fake();
        $user = $this->customer();
        $item = $this->testPart();
        $this->addToCart($user, $item);
        $key = 'fpstore_checkout_attempt_0002';

        $first = $this->postJson('/api/v1/store/checkout', [], ['Idempotency-Key' => $key])
            ->assertCreated()->json('data.id');
        $this->postJson('/api/v1/store/checkout', [], ['Idempotency-Key' => $key])
            ->assertOk()->assertJsonPath('data.id', $first);

        $this->postJson('/api/v1/store/checkout', [], ['Idempotency-Key' => 'fpstore_checkout_attempt_0003'])
            ->assertOk()->assertJsonPath('data.id', $first);

        $this->assertDatabaseCount('storefront_orders', 1);
        $this->assertDatabaseCount('storefront_order_items', 1);
        Http::assertNothingSent();
    }

    public function test_checkout_reserves_stock_without_deducting_it_until_payment_is_added(): void
    {
        Http::fake();
        $item = $this->testPart();
        $firstCustomer = $this->customer();
        $secondCustomer = $this->customer();

        $this->addToCart($firstCustomer, $item);
        $this->postJson('/api/v1/store/checkout', [], ['Idempotency-Key' => 'fpstore_checkout_attempt_0004'])
            ->assertCreated();

        $this->assertSame(1, $item->fresh()->stock_quantity);
        $this->addToCart($secondCustomer, $item);
        $this->postJson('/api/v1/store/checkout', [], ['Idempotency-Key' => 'fpstore_checkout_attempt_0005'])
            ->assertUnprocessable()->assertJsonValidationErrors('cart');

        $this->assertDatabaseCount('storefront_orders', 1);
        $this->assertSame(1, $item->fresh()->stock_quantity);
        Http::assertNothingSent();
    }

    public function test_expired_order_releases_its_reservation_for_a_new_checkout(): void
    {
        $item = $this->testPart();
        $firstCustomer = $this->customer();
        $secondCustomer = $this->customer();

        $this->addToCart($firstCustomer, $item);
        $firstOrderId = $this->postJson('/api/v1/store/checkout', [], [
            'Idempotency-Key' => 'fpstore_checkout_attempt_0006',
        ])->assertCreated()->json('data.id');

        DB::table('storefront_orders')->where('id', $firstOrderId)->update([
            'reservation_expires_at' => now()->subMinute(),
        ]);

        $this->addToCart($secondCustomer, $item);
        $this->postJson('/api/v1/store/checkout', [], [
            'Idempotency-Key' => 'fpstore_checkout_attempt_0007',
        ])->assertCreated();

        $this->assertDatabaseHas('storefront_orders', ['id' => $firstOrderId, 'status' => 'expired']);
        $this->assertDatabaseCount('storefront_orders', 2);
        $this->assertSame(1, $item->fresh()->stock_quantity);
    }
}
