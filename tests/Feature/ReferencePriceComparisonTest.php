<?php

namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class ReferencePriceComparisonTest extends TestCase
{
    use RefreshDatabase;

    private function signIn(string $role = 'owner'): void
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => 'Operador de comparación',
            'email' => $role.Str::random(5).'@tariff.test',
            'password' => Hash::make('password'),
            'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => $role]);
        Sanctum::actingAs($user);
    }

    private function reference(array $changes = []): void
    {
        $batchId = (string) Str::ulid();
        DB::table('reference_price_import_batches')->insert([
            'id' => $batchId, 'file_name' => 'fictional-test.csv',
            'file_sha256' => str_repeat('a', 64), 'created_by' => (string) Str::ulid(),
            'status' => 'committed', 'total_rows' => 1, 'inserted_rows' => 1,
            'duplicate_rows' => 0, 'validated_rows' => null, 'expires_at' => now(),
            'committed_at' => now(), 'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('reference_price_observations')->insert(array_replace([
            'id' => (string) Str::ulid(),
            'import_batch_id' => $batchId,
            'row_sha256' => hash('sha256', $batchId),
            'source' => 'MUNDOMAC', 'source_country' => 'UY',
            'source_url' => 'https://soporte.mundomac.com/iPhone/',
            'observed_date' => '2026-10-14',
            'brand' => 'Apple', 'model' => 'iPhone 13', 'service_code' => 'BATTERY',
            'service_name' => 'Cambio de batería', 'currency' => 'USD',
            'price_minor' => 11000, 'minor_digits' => 2,
            'tax_included' => 'unknown', 'price_type' => 'published_estimate',
            'notes' => 'Dato ficticio de test', 'created_at' => now(), 'updated_at' => now(),
        ], $changes));
    }

    public function test_comparison_requires_authorization(): void
    {
        $this->getJson('/api/v1/admin/reference-prices/comparison/options')->assertUnauthorized();
        $this->getJson('/api/v1/admin/reference-prices/comparison?model=iPhone%2013&service_code=BATTERY')->assertUnauthorized();
        $this->signIn('technician');
        $this->getJson('/api/v1/admin/reference-prices/comparison/options')->assertForbidden();
        $this->postJson('/api/v1/admin/reference-prices/own-prices', [])->assertForbidden();
    }

    public function test_latest_reference_preserves_source_market_currency_and_service_variant(): void
    {
        $this->signIn();
        $this->reference();
        $this->reference([
            'observed_date' => '2026-10-15', 'price_minor' => 12000,
        ]);
        $this->reference([
            'source' => 'APPLE', 'source_country' => 'ES',
            'source_url' => 'https://support.apple.com/es-es/iphone/repair',
            'currency' => 'EUR', 'price_minor' => 13500,
        ]);
        $this->reference([
            'service_name' => 'Cambio batería premium', 'price_minor' => 14500,
        ]);

        $this->getJson('/api/v1/admin/reference-prices/comparison/options')
            ->assertOk()->assertJsonPath('data.models.0', 'iPhone 13');

        $response = $this->getJson('/api/v1/admin/reference-prices/comparison?model=iPhone%2013&service_code=BATTERY')
            ->assertOk()->assertJsonCount(3, 'data.references')
            ->assertJsonCount(0, 'data.own')
            ->assertJsonPath('data.matching_policy', 'same_model_and_service_category_only_no_verified_equivalence');

        $references = $response->json('data.references');
        $this->assertContains('120.00', array_column($references, 'price_amount'));
        $this->assertNotContains('110.00', array_column($references, 'price_amount'));
        $this->assertContains('EUR', array_column($references, 'currency'));
        $this->assertContains('USD', array_column($references, 'currency'));
        $this->assertContains('ES', array_column($references, 'source_country'));
        $this->assertContains('UY', array_column($references, 'source_country'));
    }

    public function test_own_price_lifecycle_does_not_mutate_repair_quotes_or_references(): void
    {
        $this->signIn();
        $url = '/api/v1/admin/reference-prices/own-prices';
        $data = [
            'model' => 'iPhone 13', 'service_code' => 'BATTERY',
            'service_name' => 'Cambio batería FixPhone', 'currency' => 'UYU',
            'price_amount' => '2500.00', 'notes' => 'Garantía de un mes',
        ];
        $created = $this->postJson($url, $data)->assertCreated()
            ->assertJsonPath('data.price_minor', 250000)
            ->assertJsonPath('data.version', 1);
        $id = $created->json('data.id');

        $this->postJson($url, $data)->assertStatus(409);
        $this->getJson('/api/v1/admin/reference-prices/comparison?model=iPhone%2013&service_code=BATTERY')
            ->assertOk()->assertJsonCount(1, 'data.own')->assertJsonCount(0, 'data.references');

        $this->patchJson($url.'/'.$id, [
            'price_amount' => '2700.50', 'notes' => 'Nueva tarifa', 'expected_version' => 1,
        ])->assertOk()->assertJsonPath('data.price_minor', 270050)
            ->assertJsonPath('data.version', 2);
        $this->patchJson($url.'/'.$id, [
            'price_amount' => '3000.00', 'expected_version' => 1,
        ])->assertStatus(409);

        $this->deleteJson($url.'/'.$id, ['expected_version' => 2])
            ->assertOk()->assertJsonPath('data.archived', true);
        $this->getJson('/api/v1/admin/reference-prices/comparison?model=iPhone%2013&service_code=BATTERY')
            ->assertOk()->assertJsonCount(0, 'data.own');
        $this->assertDatabaseCount('reference_price_observations', 0);
        $this->assertDatabaseCount('repair_quotes', 0);
        $this->assertDatabaseHas('audit_events', [
            'entity_type' => 'OwnRepairReferencePrice', 'entity_id' => $id,
            'event_type' => 'OWN_REPAIR_REFERENCE.ARCHIVED',
        ]);
    }

    public function test_own_price_validation_and_model_service_identity_are_enforced(): void
    {
        $this->signIn('administrator');
        $data = [
            'model' => 'iPhone 13', 'service_code' => 'SCREEN',
            'service_name' => 'Pantalla común', 'currency' => 'USD',
            'price_amount' => '75.00',
        ];
        $this->postJson('/api/v1/admin/reference-prices/own-prices', [...$data, 'currency' => 'EUR'])
            ->assertUnprocessable();
        $this->postJson('/api/v1/admin/reference-prices/own-prices', [...$data, 'price_amount' => '-1.00'])
            ->assertUnprocessable();
        $this->postJson('/api/v1/admin/reference-prices/own-prices', [...$data, 'price_amount' => '0.00'])
            ->assertUnprocessable();
        $created = $this->postJson('/api/v1/admin/reference-prices/own-prices', $data)->assertCreated();
        $this->patchJson('/api/v1/admin/reference-prices/own-prices/'.$created->json('data.id'), [
            'price_amount' => '100.00', 'service_code' => 'BATTERY', 'expected_version' => 1,
        ])->assertUnprocessable();
        $this->getJson('/api/v1/admin/reference-prices/comparison?model=iPhone%2013&service_code=UNKNOWN')
            ->assertUnprocessable();
    }
}
