<?php

namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class RepairQuoteEndpointsTest extends TestCase
{
    use RefreshDatabase;

    private function signInAs(string $role): void
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => 'Presupuestador',
            'email' => $role.'@quotes.test',
            'password' => Hash::make('not-used-in-test'),
            'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => $role]);
        Sanctum::actingAs($user);
    }

    private function quoteData(): array
    {
        return [
            'customer_name' => 'Cliente de ejemplo',
            'customer_contact' => '099 000 000',
            'device_description' => 'iPhone 11 pantalla rota',
            'device_tier' => 'media',
            'services' => [
                ['name' => 'Cambio de pantalla', 'price_minor' => 150000],
                ['name' => 'Cambio de batería', 'price_minor' => 100000],
            ],
            'parts' => [
                ['name' => 'Módulo', 'unit_cost_minor' => 200000, 'quantity' => 1],
                ['name' => 'Batería', 'unit_cost_minor' => 50000, 'quantity' => 2],
            ],
            'courier_minor' => 13000,
            'discount_minor' => 15000,
            'notes' => 'Repuestos a confirmar',
        ];
    }

    public function test_access_is_denied_without_authentication_or_permission(): void
    {
        $this->getJson('/api/v1/admin/repair-quotes')->assertUnauthorized();
        $this->postJson('/api/v1/admin/repair-quotes', $this->quoteData())->assertUnauthorized();

        $this->signInAs('technician');
        $this->getJson('/api/v1/admin/repair-quotes')->assertForbidden();
        $this->postJson('/api/v1/admin/repair-quotes', $this->quoteData())->assertForbidden();
    }

    public function test_quote_is_persisted_with_authoritative_totals_and_audit(): void
    {
        $this->signInAs('sales_operator');

        $created = $this->postJson('/api/v1/admin/repair-quotes', $this->quoteData())
            ->assertCreated()
            ->assertJsonPath('data.services_subtotal_minor', 250000)
            ->assertJsonPath('data.parts_base_minor', 300000)
            ->assertJsonPath('data.parts_total_minor', 360000)
            ->assertJsonPath('data.parts_markup_percent', 20)
            ->assertJsonPath('data.courier_minor', 13000)
            ->assertJsonPath('data.discount_minor', 15000)
            ->assertJsonPath('data.total_minor', 608000)
            ->assertJsonPath('data.currency_code', 'UYU');

        $id = $created->json('data.id');
        $this->getJson('/api/v1/admin/repair-quotes')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.services.0.name', 'Cambio de pantalla');

        $this->assertDatabaseHas('repair_quotes', ['id' => $id, 'total_minor' => 608000]);
        $this->assertDatabaseHas('audit_events', [
            'entity_type' => 'RepairQuote', 'entity_id' => $id,
            'event_type' => 'REPAIR_QUOTE.CREATED',
        ]);
    }

    public function test_discount_cannot_exceed_amount_and_services_are_required(): void
    {
        $this->signInAs('owner');
        $this->postJson('/api/v1/admin/repair-quotes', [
            ...$this->quoteData(), 'discount_minor' => 999999,
        ])->assertUnprocessable();
        $this->postJson('/api/v1/admin/repair-quotes', [
            ...$this->quoteData(), 'services' => [],
        ])->assertUnprocessable();
        $this->assertDatabaseCount('repair_quotes', 0);
    }

    public function test_original_budget_without_parts_preserves_courier_and_services(): void
    {
        $this->signInAs('administrator');
        $this->postJson('/api/v1/admin/repair-quotes', [
            ...$this->quoteData(),
            'services' => [['name' => 'Cambio de batería', 'price_minor' => 80000]],
            'parts' => [],
            'discount_minor' => 0,
        ])->assertCreated()
            ->assertJsonPath('data.parts_base_minor', 0)
            ->assertJsonPath('data.parts_total_minor', 0)
            ->assertJsonPath('data.total_minor', 93000);
    }
}
