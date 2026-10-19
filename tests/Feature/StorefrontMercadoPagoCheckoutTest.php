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

final class StorefrontMercadoPagoCheckoutTest extends TestCase
{
    use RefreshDatabase;

    private const ACCESS_TOKEN = 'APP_USR_fake_fixphone_token';
    private const WEBHOOK_SECRET = 'fixphone-webhook-test-secret';
    private const COLLECTOR_ID = '123456789';

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

    private function part(): InventoryItem
    {
        return InventoryItem::query()->create([
            'sku' => 'REP-MP-001',
            'title' => 'Repuesto de prueba FixPhone',
            'item_type' => 'spare_part',
            'brand' => 'Samsung',
            'model' => 'SM-A325M',
            'operational_status' => 'en_stock',
            'publication_status' => 'publicado',
            'inventory_purpose' => 'sell_as_spare_part',
            'is_sellable' => true,
            'stock_quantity' => 1,
            'sale_price_amount_minor' => 1000,
            'currency_code' => 'UYU',
            'metadata' => ['origin' => 'recovered', 'part_condition' => 'functional', 'is_original' => true],
        ]);
    }

    private function addToCart(User $user, InventoryItem $item): void
    {
        Sanctum::actingAs($user);
        $this->postJson('/api/v1/store/cart', ['product_id' => $item->id, 'quantity' => 1])->assertOk();
    }

    private function configureMercadoPago(): void
    {
        config([
            'mercadopago.enabled' => true,
            'mercadopago.access_token' => self::ACCESS_TOKEN,
            'mercadopago.webhook_secret' => self::WEBHOOK_SECRET,
            'mercadopago.collector_id' => self::COLLECTOR_ID,
            'mercadopago.integrator_id' => null,
        ]);
    }

    private function createInternalOrder(User $user): object
    {
        $this->addToCart($user, $this->part());
        $this->postJson('/api/v1/store/checkout', [], [
            'Idempotency-Key' => 'fpstore_mercadopago_test_0001',
        ])->assertCreated()->assertJsonPath('data.payment_initiated', false);

        $order = DB::table('storefront_orders')->first();
        $this->assertNotNull($order);
        return $order;
    }

    private function preferenceFor(object $order): array
    {
        return [
            'id' => 'pref-fixphone-001',
            'collector_id' => self::COLLECTOR_ID,
            'external_reference' => $order->external_reference,
            'init_point' => 'https://www.mercadopago.com.uy/checkout/v1/redirect?pref_id=pref-fixphone-001',
            'items' => [[
                'title' => 'Repuesto de prueba FixPhone',
                'quantity' => 1,
                'currency_id' => 'UYU',
                'unit_price' => 10.00,
            ]],
        ];
    }

    private function startProviderCheckout(object $order): void
    {
        $this->configureMercadoPago();
        Http::fake([
            'api.mercadopago.com/checkout/preferences' => Http::response($this->preferenceFor($order), 201),
        ]);

        $this->postJson('/api/v1/store/checkout', [], [
            'Idempotency-Key' => 'fpstore_mercadopago_test_0001',
        ])->assertOk()
            ->assertJsonPath('data.payment_initiated', true)
            ->assertJsonPath('data.preference_id', 'pref-fixphone-001')
            ->assertJsonPath('data.checkout_url', $this->preferenceFor($order)['init_point']);

        $this->assertDatabaseHas('storefront_orders', [
            'id' => $order->id,
            'mercadopago_preference_id' => 'pref-fixphone-001',
            'payment_status' => 'preference_created',
        ]);
    }

    public function test_preference_uses_only_the_persisted_order_and_redirects_to_checkout_pro(): void
    {
        $user = $this->customer();
        $order = $this->createInternalOrder($user);

        $this->startProviderCheckout($order);

        Http::assertSent(static function ($request) use ($user, $order): bool {
            $body = $request->data();
            return str_ends_with($request->url(), '/checkout/preferences')
                && $request->hasHeader('Authorization', 'Bearer '.self::ACCESS_TOKEN)
                && ($body['external_reference'] ?? null) === $order->external_reference
                && is_numeric($body['items'][0]['unit_price'] ?? null)
                && (float) $body['items'][0]['unit_price'] === 10.0
                && ($body['items'][0]['currency_id'] ?? null) === 'UYU'
                && ($body['items'][0]['quantity'] ?? null) === 1
                && ($body['payer']['email'] ?? null) === $user->email
                && ($body['auto_return'] ?? null) === 'approved'
                && ($body['expires'] ?? null) === true
                && str_contains((string) ($body['notification_url'] ?? ''), '/api/v1/store/payment/mercadopago/webhook');
        });

        $this->assertSame(1, $this->partCount());
        $this->assertDatabaseHas('storefront_orders', ['id' => $order->id, 'stock_deducted_at' => null]);
        Http::assertSentCount(1);
    }

    public function test_webhook_rejects_an_invalid_signature_without_querying_mercado_pago(): void
    {
        $this->configureMercadoPago();
        Http::fake();

        $this->postJson('/api/v1/store/payment/mercadopago/webhook?data_id=987654321', [], [
            'x-request-id' => 'request-invalid',
            'x-signature' => 'ts=1700000000,v1='.str_repeat('a', 64),
        ])->assertUnauthorized();

        Http::assertNothingSent();
        $this->assertDatabaseCount('storefront_payment_attempts', 0);
    }

    public function test_approved_signed_webhook_verifies_payment_and_deducts_stock_once(): void
    {
        $user = $this->customer();
        $order = $this->createInternalOrder($user);
        $this->startProviderCheckout($order);

        $paymentId = '987654321';
        $requestId = 'request-fixphone-001';
        $timestamp = (string) now()->timestamp;
        $manifest = 'id:'.$paymentId.';request-id:'.$requestId.';ts:'.$timestamp.';';
        $signature = hash_hmac('sha256', $manifest, self::WEBHOOK_SECRET);

        Http::fake([
            'api.mercadopago.com/v1/payments/'.$paymentId => Http::response([
                'id' => $paymentId,
                'collector_id' => self::COLLECTOR_ID,
                'external_reference' => $order->external_reference,
                'preference_id' => 'pref-fixphone-001',
                'transaction_amount' => 10.00,
                'currency_id' => 'UYU',
                'status' => 'approved',
                'status_detail' => 'accredited',
                'payment_method_id' => 'visa',
                'date_approved' => now()->toIso8601String(),
                'live_mode' => true,
            ], 200),
        ]);

        $sendWebhook = fn () => $this->postJson(
            '/api/v1/store/payment/mercadopago/webhook?data_id='.$paymentId,
            [],
            ['x-request-id' => $requestId, 'x-signature' => 'ts='.$timestamp.',v1='.$signature],
        );

        $sendWebhook()->assertOk()->assertJsonPath('result', 'paid');
        $this->assertSame(0, $this->partStock());
        $this->assertDatabaseHas('storefront_orders', [
            'id' => $order->id,
            'status' => 'paid',
            'payment_status' => 'approved',
            'payment_status_detail' => 'accredited',
        ]);
        $this->assertDatabaseHas('storefront_payment_attempts', [
            'order_id' => $order->id,
            'payment_id' => $paymentId,
            'status' => 'approved',
            'status_detail' => 'accredited',
            'amount_minor' => 1000,
        ]);
        $this->assertDatabaseCount('storefront_payment_attempts', 1);
        $this->assertDatabaseCount('storefront_cart_lines', 0);
        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'storefront.payment.approved',
            'entity_id' => $order->id,
            'actor_id' => 'mercadopago',
        ]);

        $sendWebhook()->assertOk()->assertJsonPath('result', 'already_paid');
        $this->assertSame(0, $this->partStock());
        $this->assertDatabaseCount('storefront_payment_attempts', 1);
        $this->assertDatabaseCount('audit_events', 1);
    }

    public function test_customer_can_only_read_their_own_order_status(): void
    {
        $owner = $this->customer();
        $order = $this->createInternalOrder($owner);
        $other = $this->customer();

        Sanctum::actingAs($other);
        $this->getJson('/api/v1/store/orders/'.$order->id)->assertNotFound();

        Sanctum::actingAs($owner);
        $this->getJson('/api/v1/store/orders/'.$order->id)
            ->assertOk()
            ->assertJsonPath('data.id', $order->id)
            ->assertJsonPath('data.payment_status', null);
    }

    private function partCount(): int
    {
        return (int) DB::table('inventory_items')->where('sku', 'REP-MP-001')->count();
    }

    private function partStock(): int
    {
        return (int) DB::table('inventory_items')->where('sku', 'REP-MP-001')->value('stock_quantity');
    }
}
