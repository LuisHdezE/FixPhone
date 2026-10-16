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

final class PhonePublicationTest extends TestCase
{
    use RefreshDatabase;

    private function signIn(): void
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(), 'name' => 'Owner',
            'email' => (string) Str::ulid().'@fixphone.test',
            'password' => Hash::make('test-password'), 'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => 'owner']);
        Sanctum::actingAs($user);
    }

    private function phone(array $overrides = []): InventoryItem
    {
        return InventoryItem::query()->create(array_merge([
            'sku' => 'FXP-SHOW-'.strtoupper(substr((string) Str::ulid(), -12)),
            'title' => 'Samsung A22 con pantalla rota', 'description' => 'Pantalla rota, equipo enciende.',
            'item_type' => 'used_phone', 'brand' => 'Samsung', 'model' => 'A22',
            'inventory_purpose' => 'sell_as_used_phone', 'operational_status' => 'disponible',
            'publication_status' => 'no_publicable', 'is_sellable' => true,
            'stock_quantity' => 1, 'dismantling_status' => 'not_started',
            'cost_amount_minor' => 50000, 'currency_code' => 'UYU',
            'metadata' => ['destination' => 'Direct Sale', 'physical_condition' => 'Damaged'],
        ], $overrides));
    }

    private function payload(bool $published = true): array
    {
        return [
            'title' => 'Samsung A22 para reparar',
            'description' => 'Pantalla rota; se vende tal cual está, sin reparación previa.',
            'price_minor' => 120000, 'currency' => 'UYU',
            'image_url' => null, 'published' => $published,
        ];
    }

    public function test_phone_can_be_published_without_repair_and_removed_without_stock_changes(): void
    {
        $this->signIn();
        $item = $this->phone();
        $url = '/api/v1/admin/inventory/phones/'.$item->id.'/publication';
        $this->patchJson($url, $this->payload())->assertOk()->assertJsonPath('data.published', true);
        $this->assertSame('disponible', $item->fresh()->operational_status);
        $this->assertSame('Damaged', $item->fresh()->metadata['physical_condition']);
        $this->assertSame(1, $item->fresh()->stock_quantity);
        $this->assertDatabaseCount('device_sale_records', 0);
        $this->getJson('/api/v1/store/products')->assertOk()->assertJsonFragment(['id' => $item->id]);
        $this->getJson('/api/v1/admin/inventory')->assertOk()->assertJsonFragment(['phone_listing_status' => 'published']);
        $this->patchJson($url, $this->payload(false))->assertOk()->assertJsonPath('data.published', false);
        $this->getJson('/api/v1/store/products')->assertOk()->assertDontSee($item->id);
        $this->assertDatabaseHas('audit_events', ['entity_id' => $item->id, 'event_type' => 'inventory.phone_publication_updated']);
    }

    public function test_cannot_publish_donor_unsellable_sold_or_partially_dismantled_phone(): void
    {
        $this->signIn();
        $cases = [
            ['inventory_purpose' => 'parts_donor', 'metadata' => ['destination' => 'Donor']],
            ['is_sellable' => false],
            ['stock_quantity' => 0],
            ['operational_status' => 'vendido'],
            ['dismantling_status' => 'partial'],
        ];
        foreach ($cases as $override) {
            $item = $this->phone($override);
            $this->patchJson('/api/v1/admin/inventory/phones/'.$item->id.'/publication', $this->payload())
                ->assertUnprocessable();
            $this->assertSame('no_publicable', $item->fresh()->publication_status);
        }
    }
}
