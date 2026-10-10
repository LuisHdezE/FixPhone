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

final class PartsDonorStorefrontTest extends TestCase
{
    use RefreshDatabase;

    private function login(): void
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => 'Operador FixPhone',
            'email' => 'owner-test@fixphone.test',
            'password' => Hash::make('strong-password-test'),
            'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => 'owner']);
        Sanctum::actingAs($user);
    }

    private function device(int $stock = 1): InventoryItem
    {
        return InventoryItem::query()->create([
            'title' => 'iPhone 11 negro 64 GB',
            'item_type' => 'used_phone',
            'brand' => 'Apple',
            'model' => 'iPhone 11',
            'operational_status' => 'ingresado',
            'publication_status' => 'no_publicable',
            'inventory_purpose' => 'parts_donor',
            'stock_quantity' => $stock,
            'is_sellable' => false,
            'metadata' => ['serial_or_imei' => '354000111222333', 'acquisition_cost' => 'private'],
            'cost_amount_minor' => 125000,
            'currency_code' => 'UYU',
        ]);
    }

    private function valuation(?string $inventoryId): array
    {
        return [
            'model_name' => 'iPhone 11',
            'fault_type' => 'icloud',
            'screen_condition' => 'good',
            'power_state' => 'yes',
            'asking_price_minor' => 390000,
            'estimated_min_minor' => 280000,
            'estimated_max_minor' => 400000,
            'minimum_price_minor' => 320000,
            'notes' => 'Cliente y notas PRIVADAS, margen',
            'market_reference' => 'Competencia PRIVADA',
            'facebook_copy' => 'Copia interna FB PRIVADA',
            'inventory_item_id' => $inventoryId,
            'public_listing_status' => 'draft',
            'public_image_url' => 'https://example.com/fotos/iphone11-real.jpg',
            'public_description' => 'Equipo original con bloqueo iCloud. Pantalla sana, se vende solo para repuestos.',
            'provenance_confirmed' => true,
        ];
    }

    public function test_draft_is_never_public_and_public_endpoint_does_not_require_login(): void
    {
        $this->login();
        $inventory = $this->device();
        $created = $this->postJson('/api/v1/admin/valuations', $this->valuation($inventory->id))
            ->assertCreated();
        $id = $created->json('data.id');

        $this->getJson('/api/v1/store/parts-donors')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/store/parts-donors/'.$id)->assertNotFound();
        $this->assertSame('no_publicable', $inventory->fresh()->publication_status);
        $this->assertSame(1, InventoryItem::query()->count());
    }

    public function test_publication_requires_real_inventory_provenance_photo_and_adequate_description(): void
    {
        $this->login();
        $inventory = $this->device();
        $this->postJson('/api/v1/admin/valuations', [
            ...$this->valuation(null), 'public_listing_status' => 'published',
        ])->assertUnprocessable()->assertJsonValidationErrors(['inventory_item_id']);

        $this->postJson('/api/v1/admin/valuations', [
            ...$this->valuation($inventory->id), 'provenance_confirmed' => false,
            'public_image_url' => null, 'public_description' => 'Poco',
            'public_listing_status' => 'published',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['provenance_confirmed', 'public_image_url', 'public_description']);

        $this->assertDatabaseCount('device_valuations', 0);
    }

    public function test_public_fields_are_whitelisted_and_unpublishing_hides_facebook_target(): void
    {
        $this->login();
        $inventory = $this->device();
        $created = $this->postJson('/api/v1/admin/valuations', [
            ...$this->valuation($inventory->id), 'public_listing_status' => 'published',
        ])->assertCreated();

        $id = $created->json('data.id');
        $this->getJson('/api/v1/store/parts-donors')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.fault_label', 'Bloqueo de activación iCloud')
            ->assertJsonPath('data.0.price_minor', 390000);

        $response = $this->getJson('/api/v1/store/parts-donors/'.$id)->assertOk()
            ->assertJsonPath('data.href', '/store/for-parts/'.$id);
        $this->assertSame([
            'id', 'model_name', 'title', 'category', 'fault_type', 'fault_label',
            'screen_condition', 'power_state', 'price_minor', 'currency_code',
            'image_url', 'images', 'description', 'availability', 'href',
        ], array_keys($response->json('data')));
        $this->assertStringNotContainsString('354000111222333', $response->getContent());
        $this->assertStringNotContainsString('PRIVADA', $response->getContent());

        $this->patchJson('/api/v1/admin/valuations/'.$id, [
            'public_listing_status' => 'draft',
        ])->assertOk();
        $this->getJson('/api/v1/store/parts-donors')->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/store/parts-donors/'.$id)->assertNotFound();
    }

    public function test_sold_out_unit_automatically_disappears_from_storefront(): void
    {
        $this->login();
        $inventory = $this->device();
        $id = $this->postJson('/api/v1/admin/valuations', [
            ...$this->valuation($inventory->id), 'public_listing_status' => 'published',
        ])->assertCreated()->json('data.id');

        $inventory->update(['stock_quantity' => 0]);
        $this->getJson('/api/v1/store/parts-donors')->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/store/parts-donors/'.$id)->assertNotFound();
    }

    public function test_product_page_injects_safe_opengraph_tags_only_for_published_listing(): void
    {
        $this->login();
        $inventory = $this->device();
        $id = $this->postJson('/api/v1/admin/valuations', [
            ...$this->valuation($inventory->id), 'public_listing_status' => 'published',
        ])->assertCreated()->json('data.id');

        // SPA build is generated by the separate frontend CI. Make a short test fixture.
        $path = public_path('index.html');
        $previous = file_exists($path) ? file_get_contents($path) : null;
        file_put_contents($path, '<!doctype html><html><head><title>FixPhone</title></head><body><div id="root"></div></body></html>');
        try {
            $this->get('/store/for-parts/'.$id)->assertOk()
                ->assertSee('og:title', false)
                ->assertSee('og:image', false)
                ->assertSee('iPhone 11 para repuestos', false);
            $this->patchJson('/api/v1/admin/valuations/'.$id, [
                'public_listing_status' => 'draft',
            ])->assertOk();
            $this->get('/store/for-parts/'.$id)->assertOk()->assertDontSee('og:image', false);
        } finally {
            if ($previous === null) {
                @unlink($path);
            } else {
                file_put_contents($path, $previous);
            }
        }
    }

    public function test_started_dismantling_withdraws_public_listing_and_prevents_republication(): void
    {
        $this->login();
        $inventory = $this->device();
        $id = $this->postJson('/api/v1/admin/valuations', [
            ...$this->valuation($inventory->id), 'public_listing_status' => 'published',
        ])->assertCreated()->json('data.id');

        $this->getJson('/api/v1/store/parts-donors')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/admin/inventory')->assertOk()
            ->assertJsonPath('data.0.public_listing_status', 'published')
            ->assertJsonPath('data.0.public_valuation_id', $id);

        $this->patchJson('/api/v1/admin/inventory/'.$inventory->id.'/dismantling', [
            'dismantling_status' => 'partial',
        ])->assertOk();

        $this->assertSame(1, $inventory->fresh()->stock_quantity);
        $this->assertDatabaseHas('device_valuations', [
            'id' => $id, 'public_listing_status' => 'draft',
        ]);
        $this->assertDatabaseHas('audit_events', [
            'entity_id' => $id, 'event_type' => 'VALUATION.UNPUBLISHED_DUE_TO_DISMANTLING',
        ]);

        $this->getJson('/api/v1/store/parts-donors')->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/store/parts-donors/'.$id)->assertNotFound();
        $this->getJson('/api/v1/admin/inventory')->assertOk()
            ->assertJsonPath('data.0.public_listing_status', 'draft')
            ->assertJsonPath('data.0.public_valuation_id', null);

        $this->patchJson('/api/v1/admin/valuations/'.$id, [
            'public_listing_status' => 'published',
        ])->assertUnprocessable()->assertJsonValidationErrors('inventory_item_id');
        $this->getJson('/api/v1/store/parts-donors')->assertJsonCount(0, 'data');
    }

    public function test_exhausted_device_is_hidden_even_if_legacy_record_was_manually_published(): void
    {
        $this->login();
        $inventory = $this->device();
        $id = $this->postJson('/api/v1/admin/valuations', [
            ...$this->valuation($inventory->id), 'public_listing_status' => 'published',
        ])->assertCreated()->json('data.id');

        // Simulate legacy/manual database change bypassing the controlled endpoint.
        $inventory->update(['dismantling_status' => 'exhausted']);
        $this->getJson('/api/v1/store/parts-donors')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/store/parts-donors/'.$id)->assertNotFound();
    }

}
