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

final class DeviceComponentExtractionTest extends TestCase
{
    use RefreshDatabase;

    private function signIn(string $role = 'owner'): void
    {
        $user = User::query()->create(['id' => (string) Str::ulid(), 'name' => 'Tester', 'email' => (string) Str::ulid().'@test.example', 'password' => Hash::make('password-test'), 'active' => true]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => $role]);
        Sanctum::actingAs($user);
    }

    private function donor(array $extra = []): InventoryItem
    {
        return InventoryItem::query()->create([...[
            'sku' => 'FXP-'.Str::random(8), 'title' => 'iPhone 11', 'item_type' => 'used_phone',
            'brand' => 'Apple', 'model' => 'iPhone 11', 'inventory_purpose' => 'parts_donor',
            'operational_status' => 'para_deshuesar', 'publication_status' => 'no_publicable', 'is_sellable' => false,
            'stock_quantity' => 1, 'dismantling_status' => 'not_started', 'cost_amount_minor' => 500000,
            'metadata' => ['brand_id' => 'brand-apple', 'device_model_id' => 'model-iphone-11', 'destination' => 'Donor'],
        ], ...$extra]);
    }

    private function partRow(string $type = 'part-battery', array $extra = []): array
    {
        return [...['type_id' => $type, 'condition' => 'functional', 'publish' => false], ...$extra];
    }

    private function extract(InventoryItem $donor, array $components, ?string $request = null)
    {
        return $this->postJson('/api/v1/admin/devices/'.$donor->id.'/components', ['request_id' => $request ?? (string) Str::uuid(), 'currency' => 'UYU', 'components' => $components]);
    }

    public function test_extracts_one_per_component_and_records_origin_and_stock(): void
    {
        $this->signIn(); $donor = $this->donor();
        $this->getJson('/api/v1/admin/devices/'.$donor->id.'/components')->assertOk()->assertJsonPath('data.brand', 'Apple');
        $response = $this->extract($donor, [$this->partRow(), $this->partRow('part-charge-port')])->assertOk();
        $this->assertCount(2, $response->json('data.items'));
        foreach ($response->json('data.items') as $item) {
            $this->assertDatabaseHas('inventory_items', ['id' => $item['id'], 'item_type' => 'spare_part', 'stock_quantity' => 1, 'brand' => 'Apple', 'model' => 'iPhone 11', 'cost_amount_minor' => null]);
            $this->assertDatabaseHas('device_part_extractions', ['donor_item_id' => $donor->id, 'spare_item_id' => $item['id'], 'quantity_before' => 0, 'quantity_after' => 1]);
        }
        $this->assertDatabaseCount('inventory_stock_adjustments', 2);
        $this->assertDatabaseHas('inventory_items', ['id' => $donor->id, 'stock_quantity' => 1, 'dismantling_status' => 'partial', 'cost_amount_minor' => 500000]);
        $this->assertDatabaseHas('audit_events', ['entity_id' => $donor->id, 'event_type' => 'inventory.components_extracted']);
    }

    public function test_retries_are_idempotent_and_second_request_cannot_reextract(): void
    {
        $this->signIn(); $donor = $this->donor(); $uuid = (string) Str::uuid();
        $first = $this->extract($donor, [$this->partRow()], $uuid)->assertOk();
        $this->extract($donor, [$this->partRow()], $uuid)->assertOk()->assertJsonPath('data.replayed', true);
        $this->extract($donor, [$this->partRow('part-charge-port')], $uuid)->assertConflict();
        $this->extract($donor, [$this->partRow()])->assertUnprocessable();
        $this->assertDatabaseHas('inventory_items', ['id' => $first->json('data.items.0.id'), 'stock_quantity' => 1]);
        $this->assertDatabaseCount('device_part_extractions', 1);
    }

    public function test_same_part_from_second_donor_adds_to_existing_stock(): void
    {
        $this->signIn();
        $first = $this->extract($this->donor(), [$this->partRow()])->assertOk();
        $this->extract($this->donor(), [$this->partRow()])->assertOk()->assertJsonPath('data.items.0.created', false)->assertJsonPath('data.items.0.quantity_after', 2);
        $this->assertSame(1, InventoryItem::query()->where('item_type', 'spare_part')->count());
        $this->assertDatabaseHas('inventory_items', ['id' => $first->json('data.items.0.id'), 'stock_quantity' => 2]);
    }

    public function test_condition_and_consignor_keep_separate_inventory(): void
    {
        $this->signIn(); $owner = (string) Str::ulid();
        DB::table('consignors')->insert(['id' => $owner, 'full_name' => 'Owner']);
        $this->extract($this->donor(), [$this->partRow()])->assertOk();
        $this->extract($this->donor(), [$this->partRow('part-battery', ['condition' => 'untested'])])->assertOk();
        $this->extract($this->donor(['consignor_id' => $owner, 'inventory_purpose' => 'consignation']), [$this->partRow()])->assertOk();
        $this->assertSame(3, InventoryItem::query()->where('item_type', 'spare_part')->count());
        $this->assertSame(1, InventoryItem::query()->where('item_type', 'spare_part')->where('consignor_id', $owner)->count());
    }

    public function test_display_variants_and_parent_child_are_not_double_counted(): void
    {
        $this->signIn(); $donor = $this->donor();
        $this->extract($donor, [$this->partRow('part-display-oled'), $this->partRow('part-display-lcd')])->assertUnprocessable();
        $this->extract($donor, [$this->partRow('part-camera'), $this->partRow('part-camera-front')])->assertUnprocessable();
        $this->extract($donor, [$this->partRow('part-camera-front'), $this->partRow('part-camera-rear')])->assertOk();
        $this->assertDatabaseCount('device_part_extractions', 2);
    }

    public function test_batch_rolls_back_all_items_and_codes_if_existing_price_conflicts(): void
    {
        $this->signIn();
        $this->extract($this->donor(), [$this->partRow('part-display', ['sale_price_minor' => 20000])])->assertOk();
        $before = DB::table('inventory_spare_part_sequences')->value('next_number');
        $this->extract($this->donor(), [$this->partRow('part-battery'), $this->partRow('part-display', ['sale_price_minor' => 30000])])->assertUnprocessable();
        $this->assertSame(1, InventoryItem::query()->where('item_type', 'spare_part')->count());
        $this->assertDatabaseCount('device_extraction_batches', 1);
        $this->assertDatabaseCount('device_part_extractions', 1);
        $this->assertDatabaseHas('inventory_spare_part_sequences', ['id' => 1, 'next_number' => $before]);
    }

    public function test_invalid_donor_types_and_exhausted_devices_are_rejected(): void
    {
        $this->signIn();
        $this->extract($this->donor(['item_type' => 'spare_part']), [$this->partRow()])->assertUnprocessable();
        $this->extract($this->donor(['metadata' => ['destination' => 'Refurbish']]), [$this->partRow()])->assertUnprocessable();
        $this->extract($this->donor(['dismantling_status' => 'exhausted']), [$this->partRow()])->assertConflict();
        $this->assertDatabaseCount('device_part_extractions', 0);
    }

    public function test_permissions_and_invalid_types_do_not_mutate_stock(): void
    {
        $donor = $this->donor();
        $this->extract($donor, [$this->partRow()])->assertUnauthorized();
        $this->signIn('technician');
        $this->extract($donor, [$this->partRow()])->assertForbidden();
        $this->signIn();
        $this->extract($donor, [$this->partRow('missing-type')])->assertUnprocessable();
        $this->assertDatabaseCount('device_part_extractions', 0);
    }

    public function test_publication_is_explicit_and_public_payload_has_no_private_details(): void
    {
        $this->signIn();
        $draft = $this->extract($this->donor(), [$this->partRow('part-battery', ['condition' => 'untested'])])->assertOk();
        $id = $draft->json('data.items.0.id');
        $this->getJson('/api/v1/store/products')->assertOk()->assertJsonCount(0);
        $url = '/api/v1/admin/inventory/spare-parts/'.$id.'/publication';
        $publication = ['condition' => 'untested', 'price_minor' => 12345, 'currency' => 'UYU', 'published' => true];
        $this->patchJson($url, $publication)->assertUnprocessable();
        $publication['condition'] = 'functional';
        $this->patchJson($url, $publication)->assertOk();
        $public = $this->getJson('/api/v1/store/products')->assertOk()->assertJsonCount(1)->assertJsonPath('0.sale_price_amount_minor', 12345)->assertJsonPath('0.metadata.origin', 'recovered');
        $this->assertArrayNotHasKey('consignor_id', $public->json('0'));
        $this->assertArrayNotHasKey('cost_amount_minor', $public->json('0'));
        $this->patchJson($url, [...$publication, 'published' => false])->assertOk();
        $this->getJson('/api/v1/store/products')->assertOk()->assertJsonCount(0);
    }

    public function test_immediate_publication_and_future_additions_keep_one_article(): void
    {
        $this->signIn();
        $this->extract($this->donor(), [$this->partRow('part-battery', ['publish' => true, 'sale_price_minor' => 10000])])->assertOk()->assertJsonPath('data.items.0.published', true);
        $this->extract($this->donor(), [$this->partRow()])->assertOk()->assertJsonPath('data.items.0.quantity_after', 2);
        $this->getJson('/api/v1/store/products')->assertOk()->assertJsonCount(1)->assertJsonPath('0.stock_quantity', 2);
    }
    public function test_publication_cannot_bypass_catalog_permission_with_numeric_boolean(): void
    {
        $this->signIn('technician');
        DB::table('role_permissions')->insert(['role_slug' => 'technician', 'permission_slug' => 'inventory.adjust']);
        $this->extract($this->donor(), [$this->partRow('part-battery', ['publish' => 1, 'sale_price_minor' => 10000])])->assertForbidden();
        $this->assertDatabaseCount('device_part_extractions', 0);
    }

    public function test_source_is_protected_after_extraction(): void
    {
        $this->signIn(); $donor = $this->donor();
        $this->extract($donor, [$this->partRow()])->assertOk();
        $this->deleteJson('/api/v1/admin/inventory/'.$donor->id)->assertConflict();
        $this->patchJson('/api/v1/admin/inventory/items/'.$donor->id, ['title' => 'Other phone'])->assertConflict();
        $this->postJson('/api/v1/admin/devices/'.$donor->id.'/sell', ['request_id' => (string) Str::uuid(), 'effective_sale_price_minor' => 10000])->assertConflict();
        $this->assertDatabaseHas('inventory_items', ['id' => $donor->id, 'title' => 'iPhone 11']);
    }

    public function test_reserved_donor_cannot_generate_components(): void
    {
        $this->signIn(); $donor = $this->donor();
        $customer = (string) Str::ulid(); $order = (string) Str::ulid();
        DB::table('crm_customers')->insert(['id' => $customer, 'full_name' => 'Customer']);
        DB::table('orders')->insert(['id' => $order, 'order_number' => 'EXTRACTION-TEST', 'customer_id' => $customer, 'customer_name_snapshot' => 'Customer', 'created_by_actor_id' => 'test']);
        DB::table('order_items')->insert(['id' => (string) Str::ulid(), 'order_id' => $order, 'inventory_item_id' => $donor->id, 'item_name_snapshot' => 'iPhone', 'item_type_snapshot' => 'used_phone', 'quantity' => 1, 'unit_price_minor' => 10000, 'line_total_minor' => 10000]);
        $this->extract($donor, [$this->partRow()])->assertConflict();
        $this->assertDatabaseCount('device_part_extractions', 0);
    }

}
