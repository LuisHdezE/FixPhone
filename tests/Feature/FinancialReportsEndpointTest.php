<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Infrastructure\Identity\User;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

class FinancialReportsEndpointTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsOwner(): User
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => 'Owner',
            'email' => 'finance-owner@fixphone.test',
            'password' => Hash::make('not-used'),
            'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => 'owner']);
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_installed_parts_expenses_report_empty_state_and_success(): void
    {
        $this->actingAsOwner();

        $response = $this->getJson('/api/v1/admin/reports/installed-parts-expenses?year_month=' . now()->format('Y-m'));
        
        $response->assertStatus(200)
                 ->assertJsonPath('data.total_expenses_minor', 0)
                 ->assertJsonPath('data.total_parts_count', 0)
                 ->assertJsonPath('data.total_devices_count', 0)
                 ->assertJsonPath('data.by_device', []);
    }

    public function test_direct_sales_settlements_report_empty_state_and_success(): void
    {
        $this->actingAsOwner();

        $response = $this->getJson('/api/v1/admin/reports/direct-sales-settlements?year_month=' . now()->format('Y-m'));
        
        $response->assertStatus(200)
                 ->assertJsonPath('data.totals.total_direct_sales_count', 0)
                 ->assertJsonPath('data.totals.total_sales_amount_minor', 0)
                 ->assertJsonPath('data.totals.total_initial_costs_minor', 0)
                 ->assertJsonPath('data.totals.total_installed_parts_costs_minor', 0)
                 ->assertJsonPath('data.totals.total_settlable_profit_minor', 0)
                 ->assertJsonPath('data.totals.total_liquidation_amount_minor', 0)
                 ->assertJsonPath('data.settlements', [])
                 ->assertJsonPath('data.legacy_pending_conciliation', []);
    }
}
