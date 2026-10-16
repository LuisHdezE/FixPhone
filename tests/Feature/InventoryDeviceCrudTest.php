<?php

namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\MasterData\MasterDataEntry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class InventoryDeviceCrudTest extends TestCase
{
    use RefreshDatabase;

    private function signIn(string $role): void
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => $role,
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
            'sku' => 'FXP-9001',
            'title' => 'iPhone 11',
            'item_type' => 'used_phone',
            'brand' => 'Apple',
            'model' => 'iPhone 11',
            'operational_status' => 'ingresado',
            'publication_status' => 'no_publicable',
            'inventory_purpose' => 'internal_use',
            'stock_quantity' => 1,
            'cost_amount_minor' => 300000,
            'currency_code' => 'UYU',
            'metadata' => ['origin_marker' => 'preservar', 'serial_or_imei' => 'OLD', 'device_model_id' => 'OLDID', 'condition_id' => 'OLDCONDITION'],
        ], $attributes));
    }

    private function updatePayload(): array
    {
        foreach ([
            ['id' => 'brand-apple', 'kind' => 'brands', 'payload' => ['id' => 'brand-apple', 'name' => 'Apple', 'active' => true]],
            ['id' => 'model-iphone-11-pro', 'kind' => 'deviceModels', 'payload' => ['id' => 'model-iphone-11-pro', 'brandId' => 'brand-apple', 'name' => 'iPhone 11 Pro', 'active' => true]],
            ['id' => 'storage-128', 'kind' => 'storageCapacities', 'payload' => ['id' => 'storage-128', 'label' => '128 GB', 'active' => true]],
            ['id' => 'color-blue', 'kind' => 'colors', 'payload' => ['id' => 'color-blue', 'name' => 'Azul', 'active' => true]],
            ['id' => 'condition-good', 'kind' => 'conditions', 'payload' => ['id' => 'condition-good', 'name' => 'Bueno', 'grade' => 'A', 'active' => true]],
        ] as $entry) {
            MasterDataEntry::query()->firstOrCreate(['id' => $entry['id']], $entry);
        }

        return [
            'brand_id' => 'brand-apple',
            'device_model_id' => 'model-iphone-11-pro',
            'storage_capacity_id' => 'storage-128',
            'color_id' => 'color-blue',
            'condition_id' => 'condition-good',
            'description' => 'Equipo revisado',
            'serial_or_imei' => 'NEW123',
            'powers_on' => 'Yes',
            'account_lock' => 'Clear',
            'acquisition_source' => 'Compra directa',
            'cost_amount_minor' => 350000,
            'currency_code' => 'UYU',
        ];
    }

    public function test_device_crud_requires_authentication_and_catalog_permission(): void
    {
        $device = $this->device();
        $path = '/api/v1/admin/inventory/'.$device->id;
        $this->patchJson($path, $this->updatePayload())->assertUnauthorized();
        $this->deleteJson($path)->assertUnauthorized();

        $this->signIn('intake_operator');
        $this->getJson('/api/v1/admin/inventory')->assertOk();
        $this->patchJson($path, $this->updatePayload())->assertForbidden();
        $this->deleteJson($path)->assertForbidden();
        $this->assertDatabaseHas('inventory_items', ['id' => $device->id, 'deleted_at' => null]);
    }

    public function test_owner_can_edit_only_device_fields_with_auditable_history(): void
    {
        $this->signIn('owner');
        $device = $this->device();
        $path = '/api/v1/admin/inventory/'.$device->id;

        $this->patchJson($path, $this->updatePayload())->assertOk()
            ->assertJsonPath('data.title', 'Apple iPhone 11 Pro 128 GB')
            ->assertJsonPath('data.metadata.serial_or_imei', 'NEW123')
            ->assertJsonPath('data.metadata.origin_marker', 'preservar')
            ->assertJsonPath('data.metadata.brand_id', 'brand-apple')
            ->assertJsonPath('data.metadata.device_model_id', 'model-iphone-11-pro')
            ->assertJsonPath('data.metadata.condition_id', 'condition-good');

        $fresh = $device->fresh();
        $this->assertSame('FXP-9001', $fresh->sku);
        $this->assertSame(1, $fresh->stock_quantity);
        $this->assertSame(350000, $fresh->cost_amount_minor);
        $this->assertDatabaseHas('audit_events', [
            'entity_id' => $device->id,
            'event_type' => 'inventory.device_updated',
            'action' => 'update',
        ]);

        $this->patchJson($path, [...$this->updatePayload(), 'sku' => 'FXP-9999'])
            ->assertUnprocessable();
        $this->assertSame('FXP-9001', $device->fresh()->sku);
    }

    public function test_edit_rejects_model_of_another_brand_and_unknown_ids(): void
    {
        $this->signIn('owner');
        $device = $this->device();
        $payload = $this->updatePayload();

        MasterDataEntry::query()->create([
            'id' => 'brand-test-other', 'kind' => 'brands',
            'payload' => ['id' => 'brand-test-other', 'name' => 'Samsung', 'active' => true],
        ]);
        MasterDataEntry::query()->create([
            'id' => 'model-test-other', 'kind' => 'deviceModels',
            'payload' => ['id' => 'model-test-other', 'brandId' => 'brand-test-other', 'name' => 'Galaxy', 'active' => true],
        ]);

        $path = '/api/v1/admin/inventory/'.$device->id;
        $this->patchJson($path, [...$payload, 'device_model_id' => 'model-test-other'])
            ->assertUnprocessable()->assertJsonValidationErrors(['device_model_id']);

        $this->patchJson($path, [...$payload, 'brand_id' => 'not-a-brand'])
            ->assertUnprocessable()->assertJsonValidationErrors(['brand_id']);

        $this->patchJson($path, [...$payload, 'model' => 'Galaxy'])
            ->assertUnprocessable()->assertJsonValidationErrors(['device']);

        $this->assertSame('iPhone 11', $device->fresh()->title);
        $this->assertDatabaseCount('inventory_items', 1);
    }

    public function test_edit_preserves_legacy_optional_properties_when_no_catalog_match_is_selected(): void
    {
        $this->signIn('owner');
        $device = $this->device([
            'metadata' => [
                'storage' => '256 GB legacy',
                'color' => 'Color legado',
                'physical_condition' => 'Fair',
                'origin_marker' => 'preservar',
            ],
        ]);
        $payload = $this->updatePayload();
        $payload['storage_capacity_id'] = null;
        $payload['color_id'] = null;
        $payload['condition_id'] = null;
        $this->patchJson('/api/v1/admin/inventory/'.$device->id, $payload)
            ->assertOk()
            ->assertJsonPath('data.metadata.storage', '256 GB legacy')
            ->assertJsonPath('data.metadata.color', 'Color legado')
            ->assertJsonPath('data.metadata.physical_condition', 'Fair')
            ->assertJsonPath('data.metadata.origin_marker', 'preservar');
    }

    public function test_owner_can_edit_brand_model_and_characteristics_after_technical_evaluation(): void
    {
        $this->signIn('owner');
        $device = $this->device();
        $checks = array_map(static fn (string $key): array => [
            'key' => $key,
            'result' => $key === 'display_touch' ? 'ok' : 'not_tested',
            'notes' => null,
        ], ['display_touch', 'housing', 'moisture', 'battery_charging', 'cameras', 'audio_microphones', 'connectivity', 'biometrics']);
        $this->postJson('/api/v1/admin/devices/'.$device->id.'/technical-evaluations', [
            'request_id' => (string) Str::uuid(),
            'notes' => 'Evaluación original',
            'checks' => $checks,
        ])->assertCreated();
        $this->patchJson('/api/v1/admin/inventory/'.$device->id, $this->updatePayload())
            ->assertOk()->assertJsonPath('data.model', 'iPhone 11 Pro')
            ->assertJsonPath('data.metadata.color', 'Azul');
        $this->getJson('/api/v1/admin/inventory')->assertOk()
            ->assertJsonPath('data.0.metadata.device_model_id', 'model-iphone-11-pro');
        $this->assertDatabaseCount('device_technical_evaluations', 1);
        $this->assertDatabaseCount('device_technical_checks', 8);
        $this->assertDatabaseHas('audit_events', [
            'entity_id' => $device->id,
            'event_type' => 'inventory.device_updated',
        ]);
        $this->assertSame('FXP-9001', $device->fresh()->sku);
    }

    public function test_published_device_identity_can_be_corrected_without_changing_commercial_terms(): void
    {
        $this->signIn('owner');
        $device = $this->device([
            'publication_status' => 'publicado',
            'is_sellable' => true,
            'inventory_purpose' => 'parts_donor',
            'sale_price_amount_minor' => 650000,
        ]);
        $valuationId = (string) Str::ulid();
        DB::table('device_valuations')->insert([
            'id' => $valuationId,
            'inventory_item_id' => $device->id,
            'model_name' => 'Apple iPhone 11',
            'fault_type' => 'other',
            'asking_price_minor' => 600000,
            'public_listing_status' => 'published',
            'public_image_url' => 'https://example.test/phone.jpg',
            'public_description' => 'Pantalla rota; dispositivo para repuestos, revisado.',
            'provenance_confirmed' => true,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->patchJson('/api/v1/admin/inventory/'.$device->id, $this->updatePayload())
            ->assertOk()->assertJsonPath('data.model', 'iPhone 11 Pro');
        $this->getJson('/api/v1/admin/inventory')->assertOk()
            ->assertJsonPath('data.0.metadata.device_model_id', 'model-iphone-11-pro');
        $valuation = DB::table('device_valuations')->where('id', $valuationId)->first();
        $this->assertSame('Apple iPhone 11 Pro', $valuation->model_name);
        $this->assertSame(600000, $valuation->asking_price_minor);
        $this->assertSame('published', $valuation->public_listing_status);
        $this->assertSame(650000, $device->fresh()->sale_price_amount_minor);
        $this->assertTrue((bool) $device->fresh()->is_sellable);
        $this->assertSame('publicado', $device->fresh()->publication_status);
        $this->assertDatabaseHas('audit_events', ['entity_id' => $device->id, 'event_type' => 'inventory.device_updated']);
    }

    public function test_ownership_can_be_corrected_to_consignment_and_back(): void
    {
        $this->signIn('owner');
        $device = $this->device(['metadata' => ['destination' => 'Refurbish']]);
        $id = (string) Str::ulid();
        DB::table('consignors')->insert([
            'id' => $id, 'full_name' => 'Consignante de prueba',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $path = '/api/v1/admin/inventory/'.$device->id;
        $payload = $this->updatePayload();
        $this->patchJson($path, [...$payload, 'ownership_type' => 'consignment',
            'consignor_id' => $id, 'ownership_correction_reason' => 'Registrado como propio por error'])
            ->assertOk()->assertJsonPath('data.consignor_id', $id)
            ->assertJsonPath('data.inventory_purpose', 'consignation');
        $this->assertSame('Refurbish', $device->fresh()->metadata['destination']);
        $this->patchJson($path, [...$payload, 'ownership_type' => 'owned',
            'consignor_id' => null, 'ownership_correction_reason' => 'En realidad es equipo propio'])
            ->assertOk()->assertJsonPath('data.consignor_id', null)
            ->assertJsonPath('data.inventory_purpose', 'repair_then_sell');
        $this->assertSame('FXP-9001', $device->fresh()->sku);
        $this->assertDatabaseCount('audit_events', 2);
    }

    public function test_ownership_correction_requires_reason_and_consignor(): void
    {
        $this->signIn('owner');
        $device = $this->device();
        $path = '/api/v1/admin/inventory/'.$device->id;
        $this->patchJson($path, [...$this->updatePayload(), 'ownership_type' => 'consignment',
            'consignor_id' => null, 'ownership_correction_reason' => ''])
            ->assertUnprocessable()->assertJsonValidationErrors(['ownership_correction_reason']);
        $this->patchJson($path, [...$this->updatePayload(), 'ownership_type' => 'consignment',
            'consignor_id' => null, 'ownership_correction_reason' => 'Error de registro detectado'])
            ->assertUnprocessable()->assertJsonValidationErrors(['consignor_id']);
        $this->assertNull($device->fresh()->consignor_id);
    }

    public function test_delete_is_logical_and_keeps_permanent_device_code_and_audit(): void
    {
        $this->signIn('owner');
        $device = $this->device();
        $this->deleteJson('/api/v1/admin/inventory/'.$device->id)->assertOk();
        $this->assertSoftDeleted('inventory_items', ['id' => $device->id, 'sku' => 'FXP-9001']);
        $this->assertDatabaseHas('audit_events', [
            'entity_id' => $device->id,
            'event_type' => 'inventory.device_archived',
            'action' => 'delete',
        ]);
        $this->getJson('/api/v1/admin/inventory')->assertOk()->assertJsonCount(0, 'data');
        $this->assertSame('FXP-9001', InventoryItem::withTrashed()->findOrFail($device->id)->sku);
        $this->deleteJson('/api/v1/admin/inventory/'.$device->id)->assertNotFound();
    }

    public function test_delete_refuses_devices_with_part_history_or_publication(): void
    {
        $this->signIn('owner');
        $device = $this->device();
        DB::table('device_installed_parts')->insert([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $device->id,
            'part_name' => 'Pantalla',
            'cost_amount_minor' => 50000,
            'currency_code' => 'UYU',
            'installed_at' => now(),
            'installed_by_actor_id' => 'owner',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $path = '/api/v1/admin/inventory/'.$device->id;
        $this->deleteJson($path)->assertStatus(409);
        $this->patchJson($path, $this->updatePayload())->assertStatus(409)
            ->assertJsonPath('detail', 'No se puede editar un equipo con ventas, repuestos, tasaciones, ajustes o historial de venta. Conservá su trazabilidad.');
        $this->assertDatabaseHas('inventory_items', ['id' => $device->id, 'deleted_at' => null]);
        DB::table('device_installed_parts')->where('inventory_item_id', $device->id)->delete();

        $device->publication_status = 'publicado';
        $device->save();
        $this->deleteJson($path)->assertStatus(409);
        $this->assertDatabaseHas('inventory_items', ['id' => $device->id, 'deleted_at' => null]);
    }

    public function test_other_item_types_are_rejected(): void
    {
        $this->signIn('owner');
        $item = $this->device(['item_type' => 'spare_part']);
        $path = '/api/v1/admin/inventory/'.$item->id;
        $this->deleteJson($path)->assertStatus(422);
        $this->patchJson($path, $this->updatePayload())->assertStatus(422);
    }
}
