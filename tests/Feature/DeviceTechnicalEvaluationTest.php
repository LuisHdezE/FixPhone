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

final class DeviceTechnicalEvaluationTest extends TestCase
{
    use RefreshDatabase;

    private const KEYS = [
        'display_touch', 'housing', 'moisture', 'battery_charging',
        'cameras', 'audio_microphones', 'connectivity', 'biometrics',
    ];

    private function signIn(string $role = 'technician'): void
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => 'Técnico de prueba',
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
            'sku' => 'FXP-TECH-001',
            'title' => 'iPhone 12',
            'item_type' => 'used_phone',
            'brand' => 'Apple',
            'model' => 'iPhone 12',
            'operational_status' => 'ingresado',
            'publication_status' => 'no_publicable',
            'inventory_purpose' => 'repair_then_sell',
            'stock_quantity' => 1,
            'cost_amount_minor' => 250000,
            'sale_price_amount_minor' => 400000,
            'currency_code' => 'UYU',
            'metadata' => ['serial_or_imei' => 'TEST-IMEI'],
        ], $attributes));
    }

    private function body(array $overrides = []): array
    {
        return array_merge([
            'request_id' => (string) Str::uuid(),
            'notes' => 'Equipo diagnosticado en banco de pruebas.',
            'checks' => array_map(static fn (string $key): array => [
                'key' => $key,
                'result' => $key === 'display_touch' ? 'ok' : 'not_tested',
                'notes' => $key === 'display_touch' ? 'Táctil probado en toda la superficie.' : null,
            ], self::KEYS),
        ], $overrides);
    }

    private function path(InventoryItem $device): string
    {
        return '/api/v1/admin/devices/'.$device->id.'/technical-evaluations';
    }

    public function test_unauthenticated_cannot_read_or_create_technical_evaluations(): void
    {
        $device = $this->device();
        $this->getJson($this->path($device))->assertUnauthorized();
        $this->postJson($this->path($device), $this->body())->assertUnauthorized();
    }

    public function test_inventory_reader_can_read_but_not_write_diagnoses(): void
    {
        $device = $this->device();
        $this->signIn('inventory_operator');
        $this->getJson($this->path($device))->assertOk()->assertJsonCount(0, 'data');
        $this->postJson($this->path($device), $this->body())->assertForbidden();
    }

    public function test_technician_can_append_history_with_eight_checks_without_mutating_inventory(): void
    {
        $this->signIn();
        $device = $this->device();

        $first = $this->postJson($this->path($device), $this->body())
            ->assertCreated()
            ->assertJsonPath('data.revision', 1)
            ->assertJsonPath('data.overall_result', 'partial')
            ->assertJsonPath('data.device_sku_snapshot', 'FXP-TECH-001')
            ->assertJsonPath('data.technician_name', 'Técnico de prueba')
            ->assertJsonCount(8, 'data.checks')
            ->json('data.id');

        $next = $this->body();
        $next['checks'][1]['result'] = 'fault';
        $next['checks'][1]['notes'] = 'Carcasa rota.';
        $second = $this->postJson($this->path($device), $next)
            ->assertCreated()->assertJsonPath('data.revision', 2)
            ->assertJsonPath('data.overall_result', 'with_faults')
            ->json('data.id');

        $history = $this->getJson($this->path($device))
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $second)
            ->assertJsonPath('data.1.id', $first)
            ->assertJsonPath('data.1.overall_result', 'partial');

        $this->assertSame('Carcasa rota.', collect($history->json('data.0.checks'))->firstWhere('check_key', 'housing')['notes']);
        $this->assertDatabaseCount('device_technical_evaluations', 2);
        $this->assertDatabaseCount('device_technical_checks', 16);
        $this->assertDatabaseHas('audit_events', ['entity_id' => $first, 'event_type' => 'device.technical_evaluation_recorded']);
        $this->assertDatabaseHas('audit_events', ['entity_id' => $second, 'event_type' => 'device.technical_evaluation_recorded']);
        $this->assertSame(1, $device->fresh()->stock_quantity);
        $this->assertSame(250000, $device->fresh()->cost_amount_minor);
        $this->assertSame(400000, $device->fresh()->sale_price_amount_minor);
        $this->assertSame('ingresado', $device->fresh()->operational_status);
        $this->assertDatabaseCount('device_sale_records', 0);
    }

    public function test_validation_rejects_fake_results_missing_keys_duplicates_and_unverified_checks(): void
    {
        $this->signIn();
        $device = $this->device();
        $payload = $this->body();
        $payload['checks'][0]['result'] = 'perfect';
        $this->postJson($this->path($device), $payload)->assertUnprocessable()->assertJsonValidationErrors(['checks.0.result']);

        $payload = $this->body();
        array_pop($payload['checks']);
        $this->postJson($this->path($device), $payload)->assertUnprocessable()->assertJsonValidationErrors(['checks']);

        $payload = $this->body();
        $payload['checks'][1]['key'] = 'display_touch';
        $this->postJson($this->path($device), $payload)->assertUnprocessable();

        $payload = $this->body();
        $payload['checks'][0]['result'] = 'not_applicable';
        $this->postJson($this->path($device), $payload)->assertUnprocessable()->assertJsonValidationErrors(['checks']);

        $payload = $this->body();
        $payload['checks'][0]['sale_price_amount_minor'] = 1;
        $this->postJson($this->path($device), $payload)->assertUnprocessable()->assertJsonValidationErrors(['checks.0']);

        $payload = $this->body(['cost_amount_minor' => 1]);
        $this->postJson($this->path($device), $payload)->assertUnprocessable()->assertJsonValidationErrors(['evaluation']);
        $this->assertDatabaseCount('device_technical_evaluations', 0);
    }

    public function test_duplicate_request_and_sold_device_are_rejected(): void
    {
        $this->signIn();
        $device = $this->device();
        $payload = $this->body();
        $this->postJson($this->path($device), $payload)->assertCreated();
        $this->postJson($this->path($device), $payload)->assertStatus(409);
        $this->assertDatabaseCount('device_technical_evaluations', 1);

        $device->update(['operational_status' => 'vendido']);
        $this->getJson($this->path($device))->assertOk()->assertJsonCount(1, 'data');
        $this->postJson($this->path($device), $this->body())->assertStatus(409);
    }

    public function test_a_diagnosed_device_cannot_be_archived_and_invalid_identity_is_rejected(): void
    {
        $this->signIn('technician');
        $device = $this->device();
        $this->postJson($this->path($device), $this->body())->assertCreated();

        $this->signIn('owner');
        $this->deleteJson('/api/v1/admin/inventory/'.$device->id)->assertStatus(409);

        $this->patchJson('/api/v1/admin/inventory/'.$device->id, [
            'brand_id' => 'brand-test',
            'device_model_id' => 'model-test',
            'powers_on' => 'Unknown',
            'account_lock' => 'Unknown',
            'currency_code' => 'UYU',
        ])->assertStatus(422);

        $this->assertDatabaseHas('inventory_items', ['id' => $device->id, 'deleted_at' => null]);
        $this->assertDatabaseCount('device_technical_evaluations', 1);
    }

    public function test_spare_part_cannot_be_evaluated_as_a_phone(): void
    {
        $this->signIn();
        $item = $this->device(['item_type' => 'spare_part', 'title' => 'Pantalla']);
        $this->getJson($this->path($item))->assertStatus(422);
        $this->postJson($this->path($item), $this->body())->assertStatus(422);
    }
}
