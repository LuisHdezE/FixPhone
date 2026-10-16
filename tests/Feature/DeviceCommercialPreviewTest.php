<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class DeviceCommercialPreviewTest extends TestCase
{
    use RefreshDatabase;

    private function signIn(?string $role): void
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => 'Usuario de prueba',
            'email' => (string) Str::ulid().'@fixphone.test',
            'password' => Hash::make('test-password'),
            'active' => true,
        ]);
        if ($role !== null) {
            DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => $role]);
        }
        Sanctum::actingAs($user);
    }

    private function device(array $overrides = []): InventoryItem
    {
        return InventoryItem::query()->create(array_merge([
            'sku' => 'FXP-PREVIEW-001',
            'title' => 'Samsung A32',
            'item_type' => 'used_phone',
            'brand' => 'Samsung',
            'model' => 'A32',
            'inventory_purpose' => 'sell_as_used_phone',
            'operational_status' => 'disponible',
            'stock_quantity' => 1,
            'cost_amount_minor' => 180000,
            'sale_price_amount_minor' => 450000,
            'currency_code' => 'UYU',
        ], $overrides));
    }

    private function payload(): array
    {
        return ['currency_code' => 'UYU', 'scenarios' => [
            ['kind' => 'sell_as_is', 'gross_sale_minor' => 335000, 'economic_extra_cost_minor' => 0, 'incremental_cash_outlay_minor' => 0, 'sale_expenses_minor' => 15000],
            ['kind' => 'refurbish', 'gross_sale_minor' => 470000, 'economic_extra_cost_minor' => 85000, 'incremental_cash_outlay_minor' => 85000, 'sale_expenses_minor' => 20000],
            ['kind' => 'dismantle', 'gross_sale_minor' => 400000, 'economic_extra_cost_minor' => 30000, 'incremental_cash_outlay_minor' => 30000, 'sale_expenses_minor' => 20000],
        ]];
    }

    private function path(InventoryItem $device): string
    {
        return '/api/v1/admin/devices/'.$device->id.'/commercial-preview';
    }

    public function test_guest_cannot_simulate(): void
    {
        $device = $this->device();
        $this->postJson($this->path($device), $this->payload())->assertUnauthorized();
    }

    public function test_user_without_inventory_permission_is_rejected(): void
    {
        $device = $this->device();
        $this->signIn(null);
        $this->postJson($this->path($device), $this->payload())->assertStatus(403);
    }

    public function test_preview_returns_comparison_and_never_writes_operational_records(): void
    {
        $device = $this->device();
        $this->signIn('owner');
        $before = [
            'inventory_items' => DB::table('inventory_items')->count(),
            'device_sale_records' => DB::table('device_sale_records')->count(),
            'device_part_extractions' => DB::table('device_part_extractions')->count(),
            'device_installed_parts' => DB::table('device_installed_parts')->count(),
            'audit_events' => DB::table('audit_events')->count(),
        ];

        $this->postJson($this->path($device), $this->payload())
            ->assertOk()
            ->assertJsonPath('data.status', 'comparison_only')
            ->assertJsonPath('data.scenarios.0.economic_profit_minor', 140000)
            ->assertJsonPath('data.recommended_kind', null);

        foreach ($before as $table => $count) {
            $this->assertSame($count, DB::table($table)->count(), $table.' unexpectedly changed');
        }
        $this->assertSame(1, $device->fresh()->stock_quantity);
        $this->assertSame('disponible', $device->fresh()->operational_status);
        $this->assertSame(450000, $device->fresh()->sale_price_amount_minor);
    }

    public function test_invalid_input_is_rejected_before_business_logic(): void
    {
        $device = $this->device();
        $this->signIn('owner');
        $bad = $this->payload();
        $bad['scenarios'][0]['gross_sale_minor'] = -2;
        $this->postJson($this->path($device), $bad)
            ->assertUnprocessable()->assertJsonValidationErrors(['scenarios.0.gross_sale_minor']);

        $bad = $this->payload();
        $bad['scenarios'][1]['kind'] = 'sell_as_is';
        $this->postJson($this->path($device), $bad)->assertUnprocessable();

        $bad = $this->payload();
        $bad['currency_code'] = 'USD';
        $this->postJson($this->path($device), $bad)->assertUnprocessable();
        $this->assertDatabaseCount('device_sale_records', 0);
    }

    public function test_missing_cost_returns_insufficient_data_instead_of_fake_profit(): void
    {
        $device = $this->device(['cost_amount_minor' => null]);
        $this->signIn('owner');
        $this->postJson($this->path($device), $this->payload())
            ->assertOk()->assertJsonPath('data.status', 'insufficient_data')
            ->assertJsonPath('data.recommended_kind', null);
    }
}
