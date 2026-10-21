<?php

namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\Storefront\DefinitiveMercadoPagoFailure;
use App\Infrastructure\Storefront\InvalidMercadoPagoPayment;
use App\Infrastructure\Storefront\MercadoPagoGateway;
use App\Infrastructure\Storefront\MercadoPagoNotificationProcessor;
use App\Infrastructure\Storefront\StorefrontMercadoPagoService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\Fakes\FakeMercadoPagoGateway;
use Tests\TestCase;

final class StorefrontMercadoPagoCheckoutTest extends TestCase
{
    use RefreshDatabase;

    private const ACCESS_TOKEN = 'APP_USR_fake_fixphone_token';

    private const WEBHOOK_SECRET = 'fixphone-webhook-test-secret';

    private const COLLECTOR_ID = '123456789';

    private const APPLICATION_ID = '1644308246418209';

    private FakeMercadoPagoGateway $gateway;

    protected function setUp(): void
    {
        parent::setUp();
        $this->gateway = new FakeMercadoPagoGateway;
        $this->app->instance(MercadoPagoGateway::class, $this->gateway);
    }

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
            'mercadopago.application_id' => self::APPLICATION_ID,
            'mercadopago.public_url' => 'https://fixphone.eliasworks.uy',
            'mercadopago.site_id' => 'MLU',
            'mercadopago.currency' => 'UYU',
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
            'client_id' => self::APPLICATION_ID,
            'collector_id' => self::COLLECTOR_ID,
            'site_id' => 'MLU',
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
        $this->gateway->preference = $this->preferenceFor($order);

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

        $this->assertCount(1, $this->gateway->createdPayloads);
        $body = $this->gateway->createdPayloads[0];
        $this->assertTrue(
            ($body['external_reference'] ?? null) === $order->external_reference
                && is_numeric($body['items'][0]['unit_price'] ?? null)
                && (float) $body['items'][0]['unit_price'] === 10.0
                && ($body['items'][0]['currency_id'] ?? null) === 'UYU'
                && ($body['items'][0]['quantity'] ?? null) === 1
                && ($body['payer']['email'] ?? null) === $user->email
                && ($body['auto_return'] ?? null) === 'approved'
                && ($body['expires'] ?? null) === true
                && str_contains((string) ($body['notification_url'] ?? ''), '/api/v1/store/payment/mercadopago/webhook')
                && str_starts_with((string) ($body['back_urls']['success'] ?? ''), 'https://fixphone.eliasworks.uy/')
        );

        $this->assertSame(1, $this->partCount());
        $this->assertDatabaseHas('storefront_orders', ['id' => $order->id, 'stock_deducted_at' => null]);
    }

    public function test_webhook_rejects_an_invalid_signature_without_querying_mercado_pago(): void
    {
        $this->configureMercadoPago();
        $this->postJson('/api/v1/store/payment/mercadopago/webhook?data_id=987654321', [], [
            'x-request-id' => 'request-invalid',
            'x-signature' => 'ts=1700000000,v1='.str_repeat('a', 64),
        ])->assertUnauthorized();

        $this->assertDatabaseCount('mercadopago_notifications', 0);
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

        $this->gateway->payments[$paymentId] = [
            'id' => $paymentId,
            'collector_id' => self::COLLECTOR_ID,
            'external_reference' => $order->external_reference,
            'order' => ['id' => '777001'],
            'transaction_amount' => 10.00,
            'currency_id' => 'UYU',
            'status' => 'approved',
            'status_detail' => 'accredited',
            'payment_method_id' => 'visa',
            'date_approved' => now()->toIso8601String(),
            'live_mode' => true,
            'date_last_updated' => now()->toIso8601String(),
        ];
        $this->gateway->merchantOrders['777001'] = [
            'id' => '777001',
            'preference_id' => 'pref-fixphone-001',
            'application_id' => self::APPLICATION_ID,
            'external_reference' => $order->external_reference,
            'site_id' => 'MLU',
            'collector' => ['id' => self::COLLECTOR_ID],
            'payments' => [['id' => $paymentId]],
        ];

        $sendWebhook = fn () => $this->postJson(
            '/api/v1/store/payment/mercadopago/webhook?data_id='.$paymentId,
            ['id' => 'notif-1', 'type' => 'payment', 'application_id' => self::APPLICATION_ID, 'live_mode' => true, 'data' => ['id' => $paymentId]],
            ['x-request-id' => $requestId, 'x-signature' => 'ts='.$timestamp.',v1='.$signature],
        );

        $sendWebhook()->assertOk()->assertJsonPath('received', true);
        $summary = $this->app->make(MercadoPagoNotificationProcessor::class)->processPending();
        $this->assertSame(1, $summary['processed']);
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
        $this->assertDatabaseCount('inventory_stock_adjustments', 1);
        $this->assertDatabaseCount('storefront_cart_lines', 0);
        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'storefront.payment.approved',
            'entity_id' => $order->id,
            'actor_id' => 'mercadopago',
        ]);

        $sendWebhook()->assertOk()->assertJsonPath('received', true);
        $this->app->make(MercadoPagoNotificationProcessor::class)->processPending();
        $this->assertSame(0, $this->partStock());
        $this->assertDatabaseCount('storefront_payment_attempts', 1);
        $this->assertDatabaseCount('inventory_stock_adjustments', 1);
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

    public function test_reconciliation_rejects_amount_currency_seller_reference_and_application_mismatches(): void
    {
        $user = $this->customer();
        $order = $this->createInternalOrder($user);
        $this->startProviderCheckout($order);
        $service = $this->app->make(StorefrontMercadoPagoService::class);

        $cases = [
            ['payment' => ['transaction_amount' => 9.99], 'merchant' => []],
            ['payment' => ['currency_id' => 'USD'], 'merchant' => []],
            ['payment' => ['collector_id' => '999'], 'merchant' => []],
            ['payment' => ['external_reference' => 'FORGED'], 'merchant' => []],
            ['payment' => [], 'merchant' => ['application_id' => '999']],
        ];

        foreach ($cases as $index => $mutations) {
            $paymentId = (string) (800000000 + $index);
            $this->gateway->payments[$paymentId] = array_replace($this->paymentFor($order, $paymentId), $mutations['payment']);
            $this->gateway->merchantOrders['mo-'.$paymentId] = array_replace($this->merchantOrderFor($order, $paymentId), $mutations['merchant']);

            try {
                $service->processPayment($paymentId, $this->gateway->merchantOrders['mo-'.$paymentId]);
                $this->fail('La reconciliación debía rechazar el caso manipulado '.$index.'.');
            } catch (InvalidMercadoPagoPayment) {
                $this->assertTrue(true);
            }
        }

        $this->assertSame(1, $this->partStock());
        $this->assertDatabaseCount('storefront_payment_attempts', 0);
    }

    public function test_out_of_order_and_duplicate_approved_payments_never_deduct_stock_twice(): void
    {
        $user = $this->customer();
        $order = $this->createInternalOrder($user);
        $this->startProviderCheckout($order);
        $service = $this->app->make(StorefrontMercadoPagoService::class);
        $firstId = '910000001';
        $merchant = $this->merchantOrderFor($order, $firstId);
        $this->gateway->payments[$firstId] = $this->paymentFor($order, $firstId);

        $this->assertSame('paid', $service->processPayment($firstId, $merchant));
        $this->gateway->payments[$firstId] = array_replace($this->paymentFor($order, $firstId), [
            'status' => 'pending',
            'status_detail' => 'pending_contingency',
            'date_last_updated' => now()->subMinute()->toIso8601String(),
        ]);
        $this->assertSame('stale_event_ignored', $service->processPayment($firstId, $merchant));
        $this->gateway->payments[$firstId]['date_last_updated'] = now()->addMinute()->toIso8601String();
        $this->assertSame('state_regression_ignored', $service->processPayment($firstId, $merchant));

        $secondId = '910000002';
        $this->gateway->payments[$secondId] = $this->paymentFor($order, $secondId);
        $merchant['payments'][] = ['id' => $secondId];
        $this->assertSame('duplicate_approved_payment', $service->processPayment($secondId, $merchant));

        $this->assertSame(0, $this->partStock());
        $this->assertDatabaseCount('inventory_stock_adjustments', 1);
        $this->assertDatabaseHas('storefront_orders', [
            'id' => $order->id,
            'status' => 'payment_review',
            'payment_review_reason' => 'duplicate_approved_payment',
        ]);
    }

    public function test_late_approved_payment_without_stock_goes_to_manual_review(): void
    {
        $user = $this->customer();
        $order = $this->createInternalOrder($user);
        $this->startProviderCheckout($order);
        DB::table('storefront_orders')->where('id', $order->id)->update(['reservation_expires_at' => now()->subMinute()]);
        DB::table('inventory_items')->where('sku', 'REP-MP-001')->update(['stock_quantity' => 0]);

        $paymentId = '920000001';
        $this->gateway->payments[$paymentId] = $this->paymentFor($order, $paymentId);
        $result = $this->app->make(StorefrontMercadoPagoService::class)
            ->processPayment($paymentId, $this->merchantOrderFor($order, $paymentId));

        $this->assertSame('late_approved_payment_stock_unavailable', $result);
        $this->assertDatabaseHas('storefront_orders', [
            'id' => $order->id,
            'status' => 'payment_review',
            'payment_review_reason' => 'late_approved_payment_stock_unavailable',
            'stock_deducted_at' => null,
        ]);
        $this->assertDatabaseCount('inventory_stock_adjustments', 0);
    }

    public function test_uncertain_retries_are_exclusive_and_never_repeat_the_preference_post(): void
    {
        $user = $this->customer();
        $order = $this->createInternalOrder($user);
        $this->configureMercadoPago();
        DB::table('storefront_orders')->where('id', $order->id)->update([
            'mercadopago_preference_started_at' => now()->subMinutes(3),
        ]);

        $fake = $this->gateway;
        $wrapper = new class($fake) implements MercadoPagoGateway
        {
            public ?\Closure $onSearch = null;

            public int $searches = 0;

            public function __construct(private FakeMercadoPagoGateway $fake) {}

            public function createPreference(array $payload): array
            {
                return $this->fake->createPreference($payload);
            }

            public function findPreferenceByExternalReference(string $externalReference): ?array
            {
                $this->searches++;
                if ($this->onSearch !== null) {
                    $callback = $this->onSearch;
                    $this->onSearch = null;
                    $callback();
                }

                return null;
            }

            public function getPayment(string $paymentId): array
            {
                return $this->fake->getPayment($paymentId);
            }

            public function getMerchantOrder(string $merchantOrderId): array
            {
                return $this->fake->getMerchantOrder($merchantOrderId);
            }

            public function findMerchantOrderByExternalReference(string $externalReference): ?array
            {
                return null;
            }

            public function findMerchantOrderForPayment(string $externalReference, string $paymentId): ?array
            {
                return null;
            }

            public function getChargeback(string $chargebackId): array
            {
                return $this->fake->getChargeback($chargebackId);
            }
        };
        $this->app->instance(MercadoPagoGateway::class, $wrapper);
        $wrapper->onSearch = function () use ($order): void {
            try {
                $this->app->make(StorefrontMercadoPagoService::class)->ensurePreference($order);
                $this->fail('La solicitud intercalada debía encontrar el reclamo exclusivo vigente.');
            } catch (HttpException $exception) {
                $this->assertSame(409, $exception->getStatusCode());
            }
        };

        foreach ([1, 2] as $retry) {
            try {
                $this->app->make(StorefrontMercadoPagoService::class)->ensurePreference($order);
                $this->fail('La ausencia temporal no debe habilitar un POST en el reintento '.$retry.'.');
            } catch (HttpException $exception) {
                $this->assertSame(409, $exception->getStatusCode());
            }
        }

        $this->assertSame(2, $wrapper->searches);
        $this->assertCount(0, $fake->createdPayloads);
        $this->assertDatabaseHas('storefront_payment_preferences', [
            'order_id' => $order->id,
            'status' => 'uncertain',
            'active_attempt_token' => null,
        ]);
    }

    public function test_abandoned_pre_dispatch_claim_can_be_recovered_safely(): void
    {
        $user = $this->customer();
        $order = $this->createInternalOrder($user);
        $this->configureMercadoPago();
        $this->gateway->preference = $this->preferenceFor($order);
        DB::table('storefront_orders')->where('id', $order->id)->update([
            'mercadopago_preference_started_at' => now()->subMinutes(3),
        ]);
        DB::table('storefront_payment_preferences')->insert([
            'id' => (string) Str::ulid(),
            'order_id' => $order->id,
            'external_reference' => $order->external_reference,
            'status' => 'claimed',
            'attempt_count' => 1,
            'active_attempt_token' => (string) Str::uuid(),
            'lease_expires_at' => now()->subMinute(),
            'request_dispatched_at' => null,
            'request_payload_hash' => str_repeat('a', 64),
            'started_at' => now()->subMinutes(3),
            'created_at' => now()->subMinutes(3),
            'updated_at' => now()->subMinutes(3),
        ]);

        $saved = $this->app->make(StorefrontMercadoPagoService::class)->ensurePreference($order);

        $this->assertSame('pref-fixphone-001', $saved->mercadopago_preference_id);
        $this->assertCount(1, $this->gateway->createdPayloads);
        $this->assertDatabaseHas('storefront_payment_preferences', [
            'order_id' => $order->id,
            'status' => 'completed',
            'attempt_count' => 2,
        ]);
    }

    public function test_only_a_definitive_provider_rejection_allows_a_new_preference_post(): void
    {
        $user = $this->customer();
        $order = $this->createInternalOrder($user);
        $this->configureMercadoPago();
        $this->gateway->createException = new DefinitiveMercadoPagoFailure('Solicitud rechazada antes de crear la preferencia.');

        try {
            $this->app->make(StorefrontMercadoPagoService::class)->ensurePreference($order);
            $this->fail('El rechazo definitivo debía propagarse.');
        } catch (DefinitiveMercadoPagoFailure) {
            $this->assertTrue(true);
        }
        $this->assertDatabaseHas('storefront_payment_preferences', [
            'order_id' => $order->id,
            'status' => 'failed_definitive',
        ]);

        $this->gateway->createException = null;
        $this->gateway->preference = $this->preferenceFor($order);
        $saved = $this->app->make(StorefrontMercadoPagoService::class)->ensurePreference($order);

        $this->assertSame('pref-fixphone-001', $saved->mercadopago_preference_id);
        $this->assertCount(2, $this->gateway->createdPayloads);
    }

    public function test_preference_save_rolls_back_both_records_and_recovers_by_reconciliation(): void
    {
        $user = $this->customer();
        $order = $this->createInternalOrder($user);
        $this->configureMercadoPago();
        $this->gateway->preference = $this->preferenceFor($order);
        DB::statement("CREATE TRIGGER fail_preference_save BEFORE UPDATE OF preference_id ON storefront_payment_preferences BEGIN SELECT RAISE(ABORT, 'injected preference failure'); END");

        try {
            $this->app->make(StorefrontMercadoPagoService::class)->ensurePreference($order);
            $this->fail('El fallo inyectado en la segunda actualización debía propagarse.');
        } catch (QueryException $exception) {
            $this->assertStringContainsString('injected preference failure', $exception->getMessage());
        }

        $this->assertNull(DB::table('storefront_orders')->where('id', $order->id)->value('mercadopago_preference_id'));
        $this->assertDatabaseHas('storefront_payment_preferences', [
            'order_id' => $order->id,
            'preference_id' => null,
            'status' => 'uncertain',
        ]);

        DB::statement('DROP TRIGGER fail_preference_save');
        $this->gateway->foundPreference = $this->preferenceFor($order);
        $saved = $this->app->make(StorefrontMercadoPagoService::class)->ensurePreference($order);

        $this->assertSame('pref-fixphone-001', $saved->mercadopago_preference_id);
        $this->assertCount(1, $this->gateway->createdPayloads, 'La recuperación debe buscar el POST anterior, no repetirlo.');
        $this->assertDatabaseHas('storefront_payment_preferences', [
            'order_id' => $order->id,
            'preference_id' => 'pref-fixphone-001',
            'status' => 'completed',
        ]);
    }

    public function test_expired_order_with_stock_reconciles_approved_payment_without_webhook(): void
    {
        $user = $this->customer();
        $order = $this->createInternalOrder($user);
        $this->startProviderCheckout($order);
        DB::table('storefront_orders')->where('id', $order->id)->update(['reservation_expires_at' => now()->subMinute()]);
        $paymentId = '930000001';
        $this->gateway->payments[$paymentId] = $this->paymentFor($order, $paymentId);
        $this->gateway->merchantOrders['mo-'.$paymentId] = $this->merchantOrderFor($order, $paymentId);

        $processor = $this->app->make(MercadoPagoNotificationProcessor::class);
        $processor->processPending();
        $this->assertSame(1, $processor->reconcileOpenOrders());

        $this->assertDatabaseHas('storefront_orders', [
            'id' => $order->id,
            'status' => 'paid',
            'payment_status' => 'approved',
        ]);
        $this->assertSame(0, $this->partStock());
    }

    public function test_expired_order_without_stock_reconciles_to_review_without_webhook(): void
    {
        $user = $this->customer();
        $order = $this->createInternalOrder($user);
        $this->startProviderCheckout($order);
        DB::table('storefront_orders')->where('id', $order->id)->update(['reservation_expires_at' => now()->subMinute()]);
        DB::table('inventory_items')->where('sku', 'REP-MP-001')->update(['stock_quantity' => 0]);
        $paymentId = '930000002';
        $this->gateway->payments[$paymentId] = $this->paymentFor($order, $paymentId);
        $this->gateway->merchantOrders['mo-'.$paymentId] = $this->merchantOrderFor($order, $paymentId);

        $processor = $this->app->make(MercadoPagoNotificationProcessor::class);
        $processor->processPending();
        $this->assertSame(1, $processor->reconcileOpenOrders());

        $this->assertDatabaseHas('storefront_orders', [
            'id' => $order->id,
            'status' => 'payment_review',
            'payment_status' => 'approved',
            'payment_review_reason' => 'late_approved_payment_stock_unavailable',
            'stock_deducted_at' => null,
        ]);
        $this->assertDatabaseCount('inventory_stock_adjustments', 0);
    }

    private function paymentFor(object $order, string $paymentId): array
    {
        return [
            'id' => $paymentId,
            'collector_id' => self::COLLECTOR_ID,
            'external_reference' => $order->external_reference,
            'order' => ['id' => 'mo-'.$paymentId],
            'transaction_amount' => 10.00,
            'currency_id' => 'UYU',
            'status' => 'approved',
            'status_detail' => 'accredited',
            'payment_method_id' => 'visa',
            'date_approved' => now()->toIso8601String(),
            'date_last_updated' => now()->toIso8601String(),
            'live_mode' => true,
        ];
    }

    private function merchantOrderFor(object $order, string $paymentId): array
    {
        return [
            'id' => 'mo-'.$paymentId,
            'preference_id' => 'pref-fixphone-001',
            'application_id' => self::APPLICATION_ID,
            'external_reference' => $order->external_reference,
            'site_id' => 'MLU',
            'collector' => ['id' => self::COLLECTOR_ID],
            'payments' => [['id' => $paymentId]],
        ];
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
