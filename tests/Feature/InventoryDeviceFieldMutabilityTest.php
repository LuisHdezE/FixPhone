<?php

namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\MasterData\MasterDataEntry;
use App\Infrastructure\Media\InventoryItemPhoto;
use App\Infrastructure\Media\InventoryItemPromotionalAsset;
use App\Infrastructure\Media\MediaStorageProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class InventoryDeviceFieldMutabilityTest extends TestCase
{
    use RefreshDatabase;

    private function signIn(string $role = 'owner'): User
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => 'Admin User',
            'email' => $role . '@fixphone.test',
            'password' => Hash::make('secret'),
            'active' => true,
        ]);
        DB::table('user_roles')->insert([
            'user_id' => $user->id,
            'role_slug' => $role,
        ]);
        Sanctum::actingAs($user);
        return $user;
    }

    private function seedMasterCatalog(): void
    {
        foreach ([
            ['id' => 'brand-apple', 'kind' => 'brands', 'payload' => ['id' => 'brand-apple', 'name' => 'Apple', 'active' => true]],
            ['id' => 'brand-samsung', 'kind' => 'brands', 'payload' => ['id' => 'brand-samsung', 'name' => 'Samsung', 'active' => true]],
            ['id' => 'model-iphone-11', 'kind' => 'deviceModels', 'payload' => ['id' => 'model-iphone-11', 'brandId' => 'brand-apple', 'name' => 'iPhone 11', 'active' => true]],
            ['id' => 'model-iphone-11-pro', 'kind' => 'deviceModels', 'payload' => ['id' => 'model-iphone-11-pro', 'brandId' => 'brand-apple', 'name' => 'iPhone 11 Pro', 'active' => true]],
            ['id' => 'model-galaxy-a22', 'kind' => 'deviceModels', 'payload' => ['id' => 'model-galaxy-a22', 'brandId' => 'brand-samsung', 'name' => 'Galaxy A22 5G', 'active' => true]],
            ['id' => 'storage-64', 'kind' => 'storageCapacities', 'payload' => ['id' => 'storage-64', 'label' => '64 GB', 'active' => true]],
            ['id' => 'storage-128', 'kind' => 'storageCapacities', 'payload' => ['id' => 'storage-128', 'label' => '128 GB', 'active' => true]],
            ['id' => 'color-blue', 'kind' => 'colors', 'payload' => ['id' => 'color-blue', 'name' => 'Azul', 'active' => true]],
            ['id' => 'color-black', 'kind' => 'colors', 'payload' => ['id' => 'color-black', 'name' => 'Negro', 'active' => true]],
            ['id' => 'condition-good', 'kind' => 'conditions', 'payload' => ['id' => 'condition-good', 'name' => 'Bueno', 'grade' => 'A', 'active' => true]],
            ['id' => 'condition-excellent', 'kind' => 'conditions', 'payload' => ['id' => 'condition-excellent', 'name' => 'Excelente', 'grade' => 'N', 'active' => true]],
        ] as $entry) {
            MasterDataEntry::query()->firstOrCreate(['id' => $entry['id']], $entry);
        }
    }

    private function seedMasterPrompt(): void
    {
        DB::table('ai_prompts')->updateOrInsert(
            ['code' => 'PROMPT-0001'],
            [
                'id' => (string) Str::ulid(),
                'version' => '1.0',
                'lock_version' => 1,
                'description' => 'Prompt Publicitario FixPhone',
                'content' => 'Publicidad FixPhone: {{modelo}} ({{codigo_fxp}}), almacenamiento: {{almacenamiento}}, color: {{color}}, precio: {{moneda}} {{precio}}.',
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }

    private function createDevice(array $overrides = []): InventoryItem
    {
        return InventoryItem::query()->create(array_merge([
            'sku' => 'FXP-0009',
            'title' => 'Apple iPhone 11',
            'item_type' => 'used_phone',
            'brand' => 'Apple',
            'model' => 'iPhone 11',
            'device_model_id' => 'model-iphone-11',
            'operational_status' => 'disponible',
            'publication_status' => 'no_publicable',
            'inventory_purpose' => 'sell_as_used_phone',
            'is_sellable' => false,
            'stock_quantity' => 1,
            'cost_amount_minor' => 300000,
            'sale_price_amount_minor' => 450000,
            'currency_code' => 'UYU',
            'metadata' => [
                'brand_id' => 'brand-apple',
                'device_model_id' => 'model-iphone-11',
                'storage_capacity_id' => null,
                'storage' => null,
                'color_id' => null,
                'condition_id' => null,
                'serial_or_imei' => '351234567890123',
                'powers_on' => 'Yes',
                'account_lock' => 'Clear',
                'destination' => 'Direct Sale',
            ],
        ], $overrides));
    }

    private function createConfirmedPhoto(string $deviceId): InventoryItemPhoto
    {
        $profile = MediaStorageProfile::query()->firstOrCreate(
            ['name' => 'primary'],
            [
                'id' => (string) Str::ulid(),
                'provider' => 'cloudflare_r2',
                'bucket' => 'fixphone-media',
                'endpoint_url' => 'https://example.r2.cloudflarestorage.com',
                'public_base_url' => 'https://media.fixphone.test',
                'object_prefix' => 'media',
                'access_key_id_encrypted' => Crypt::encryptString('AKIAIOSFODNN7EXAMPLE'),
                'secret_access_key_encrypted' => Crypt::encryptString('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'),
                'is_selected' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        return InventoryItemPhoto::query()->create([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $deviceId,
            'media_storage_profile_id' => $profile->id,
            'object_key' => 'inventory/devices/' . $deviceId . '/photos/real.webp',
            'public_url' => 'https://media.fixphone.test/inventory/devices/' . $deviceId . '/photos/real.webp',
            'content_type' => 'image/webp',
            'byte_size' => 2048,
            'status' => 'confirmed',
            'sort_order' => 0,
            'is_primary' => true,
            'upload_expires_at' => now()->addHour(),
        ]);
    }

    /**
     * Requirement 1 & 2:
     * Dispositivo con publicidad histórica puede pasar de almacenamiento vacío a 128 GB.
     * La publicidad histórica conserva prompt_snapshot, prompt_version, image_url y demás datos históricos.
     */
    public function test_device_with_historical_promotional_asset_can_complete_empty_storage_to_128gb(): void
    {
        $this->signIn('owner');
        $this->seedMasterCatalog();
        $this->seedMasterPrompt();

        $device = $this->createDevice([
            'metadata' => [
                'brand_id' => 'brand-apple',
                'device_model_id' => 'model-iphone-11',
                'storage_capacity_id' => null,
                'storage' => null,
                'serial_or_imei' => '351234567890123',
                'powers_on' => 'Yes',
                'account_lock' => 'Clear',
                'destination' => 'Direct Sale',
            ],
        ]);

        $photo = $this->createConfirmedPhoto($device->id);

        $historicalSnapshot = 'Publicidad original histórica v1.0 para iPhone 11 sin almacenamiento.';
        $historicalAsset = InventoryItemPromotionalAsset::query()->create([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $device->id,
            'source_photo_id' => $photo->id,
            'prompt_code' => 'PROMPT-0001',
            'prompt_version' => '1.0',
            'prompt_snapshot' => $historicalSnapshot,
            'status' => 'approved',
            'image_url' => 'https://media.fixphone.test/inventory/devices/' . $device->id . '/ads/ad_v1.webp',
            'object_key' => 'inventory/devices/' . $device->id . '/ads/ad_v1.webp',
            'mime_type' => 'image/webp',
            'size_bytes' => 54321,
            'approved_at' => now()->subDay(),
        ]);

        // Complete storage from empty to 128 GB
        $this->patchJson('/api/v1/admin/inventory/' . $device->id, [
            'brand_id' => 'brand-apple',
            'device_model_id' => 'model-iphone-11',
            'storage_capacity_id' => 'storage-128',
            'powers_on' => 'Yes',
            'account_lock' => 'Clear',
            'currency_code' => 'UYU',
        ])->assertOk();

        $freshDevice = $device->fresh();
        $this->assertSame('storage-128', $freshDevice->metadata['storage_capacity_id']);
        $this->assertSame('128 GB', $freshDevice->metadata['storage']);

        // Historical promotional asset remains completely intact
        $freshAsset = $historicalAsset->fresh();
        $this->assertSame($historicalSnapshot, $freshAsset->prompt_snapshot);
        $this->assertSame('1.0', $freshAsset->prompt_version);
        $this->assertSame('https://media.fixphone.test/inventory/devices/' . $device->id . '/ads/ad_v1.webp', $freshAsset->image_url);
        $this->assertSame('approved', $freshAsset->status);
        $this->assertSame(54321, $freshAsset->size_bytes);
    }

    /**
     * Requirement 3:
     * Una nueva preparación publicitaria resuelve: almacenamiento = 128 GB.
     */
    public function test_new_promotional_asset_preparation_resolves_updated_storage(): void
    {
        $this->signIn('owner');
        $this->seedMasterCatalog();
        $this->seedMasterPrompt();

        $device = $this->createDevice([
            'metadata' => [
                'brand_id' => 'brand-apple',
                'device_model_id' => 'model-iphone-11',
                'storage_capacity_id' => null,
                'storage' => null,
                'color_id' => 'color-black',
                'color' => 'Negro',
                'serial_or_imei' => '351234567890123',
                'powers_on' => 'Yes',
                'account_lock' => 'Clear',
                'destination' => 'Direct Sale',
            ],
        ]);

        $photo = $this->createConfirmedPhoto($device->id);

        // Update storage to 128 GB
        $this->patchJson('/api/v1/admin/inventory/' . $device->id, [
            'brand_id' => 'brand-apple',
            'device_model_id' => 'model-iphone-11',
            'storage_capacity_id' => 'storage-128',
            'powers_on' => 'Yes',
            'account_lock' => 'Clear',
            'currency_code' => 'UYU',
        ])->assertOk();

        // Prepare advertising with updated storage
        $response = $this->postJson('/api/v1/admin/inventory/' . $device->id . '/promotional-assets/prepare', [
            'source_photo_id' => $photo->id,
        ])->assertCreated();

        $this->assertSame('128 GB', $response->json('device_summary.almacenamiento'));
        $this->assertStringContainsString('almacenamiento: 128 GB', $response->json('data.prompt_snapshot'));
    }

    /**
     * Requirement 4 & 5:
     * Cambiar precio vigente no modifica publicidad histórica.
     * Una preparación posterior utiliza el nuevo precio.
     */
    public function test_changing_sale_price_does_not_modify_historical_asset_and_new_prep_uses_new_price(): void
    {
        $this->signIn('owner');
        $this->seedMasterCatalog();
        $this->seedMasterPrompt();

        $device = $this->createDevice([
            'sale_price_amount_minor' => 450000,
            'is_sellable' => true,
            'publication_status' => 'publicado',
            'operational_status' => 'disponible',
            'metadata' => [
                'destination' => 'Direct Sale',
                'storage' => '128 GB',
                'storage_capacity_id' => 'storage-128',
                'color' => 'Azul',
                'color_id' => 'color-blue',
            ],
        ]);

        $photo = $this->createConfirmedPhoto($device->id);

        $historicalSnapshot = 'Anuncio con precio antiguo 4.500 UYU';
        $historicalAsset = InventoryItemPromotionalAsset::query()->create([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $device->id,
            'source_photo_id' => $photo->id,
            'prompt_code' => 'PROMPT-0001',
            'prompt_version' => '1.0',
            'prompt_snapshot' => $historicalSnapshot,
            'status' => 'approved',
            'image_url' => 'https://media.fixphone.test/old_ad.webp',
        ]);

        // Change commercial price from 4.500 UYU (450000 minor) to 5.200 UYU (520000 minor) via PhonePublicationController
        $this->patchJson('/api/v1/admin/inventory/phones/' . $device->id . '/publication', [
            'title' => 'iPhone 11 128 GB Azul Reacondicionado',
            'description' => 'Dispositivo verificado en perfecto estado de funcionamiento.',
            'price_minor' => 520000,
            'currency' => 'UYU',
            'image_url' => null,
            'published' => true,
        ])->assertOk();

        $this->assertSame(520000, $device->fresh()->sale_price_amount_minor);

        // Historical promotional asset is NOT modified
        $this->assertSame($historicalSnapshot, $historicalAsset->fresh()->prompt_snapshot);
        $this->assertSame('https://media.fixphone.test/old_ad.webp', $historicalAsset->fresh()->image_url);

        // Subsequent preparation resolves the newly updated price
        $prep = $this->postJson('/api/v1/admin/inventory/' . $device->id . '/promotional-assets/prepare', [
            'source_photo_id' => $photo->id,
        ])->assertCreated();

        $this->assertSame('5.200', $prep->json('device_summary.precio'));
        $this->assertStringContainsString('precio: UYU 5.200', $prep->json('data.prompt_snapshot'));
    }

    /**
     * Requirement 6:
     * Repuesto instalado no bloquea storage.
     */
    public function test_installed_spare_part_does_not_block_updating_storage(): void
    {
        $this->signIn('owner');
        $this->seedMasterCatalog();

        $device = $this->createDevice([
            'metadata' => [
                'brand_id' => 'brand-apple',
                'device_model_id' => 'model-iphone-11',
                'storage_capacity_id' => null,
                'storage' => null,
                'serial_or_imei' => '351234567890123',
                'powers_on' => 'Yes',
                'account_lock' => 'Clear',
                'destination' => 'Refurbish',
            ],
        ]);

        // Record installed spare part
        DB::table('device_installed_parts')->insert([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $device->id,
            'part_name' => 'Batería Original iPhone 11',
            'cost_amount_minor' => 45000,
            'currency_code' => 'UYU',
            'installed_at' => now(),
            'installed_by_actor_id' => 'test-operator',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Updating storage capacity succeeds
        $this->patchJson('/api/v1/admin/inventory/' . $device->id, [
            'brand_id' => 'brand-apple',
            'device_model_id' => 'model-iphone-11',
            'storage_capacity_id' => 'storage-128',
            'powers_on' => 'Yes',
            'account_lock' => 'Clear',
            'currency_code' => 'UYU',
        ])->assertOk();

        $this->assertSame('storage-128', $device->fresh()->metadata['storage_capacity_id']);
        $this->assertSame('128 GB', $device->fresh()->metadata['storage']);
    }

    /**
     * Requirement 7:
     * Tasación no bloquea color/condición.
     */
    public function test_valuation_does_not_block_updating_color_and_condition(): void
    {
        $this->signIn('owner');
        $this->seedMasterCatalog();

        $device = $this->createDevice([
            'metadata' => [
                'brand_id' => 'brand-apple',
                'device_model_id' => 'model-iphone-11',
                'color_id' => null,
                'condition_id' => null,
                'serial_or_imei' => '351234567890123',
                'powers_on' => 'Yes',
                'account_lock' => 'Clear',
                'destination' => 'Direct Sale',
            ],
        ]);

        // Register technical evaluation and valuation
        DB::table('device_valuations')->insert([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $device->id,
            'model_name' => 'Apple iPhone 11',
            'fault_type' => 'none',
            'asking_price_minor' => 400000,
            'public_listing_status' => 'draft',
            'provenance_confirmed' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Updating color and condition succeeds
        $this->patchJson('/api/v1/admin/inventory/' . $device->id, [
            'brand_id' => 'brand-apple',
            'device_model_id' => 'model-iphone-11',
            'color_id' => 'color-blue',
            'condition_id' => 'condition-excellent',
            'powers_on' => 'Yes',
            'account_lock' => 'Clear',
            'currency_code' => 'UYU',
        ])->assertOk();

        $fresh = $device->fresh();
        $this->assertSame('color-blue', $fresh->metadata['color_id']);
        $this->assertSame('Azul', $fresh->metadata['color']);
        $this->assertSame('condition-excellent', $fresh->metadata['condition_id']);
        $this->assertSame('Excelente', $fresh->metadata['condition_name']);
    }

    /**
     * Requirement 8:
     * Stock adjustment no bloquea atributos físicos.
     */
    public function test_stock_adjustment_does_not_block_updating_physical_attributes(): void
    {
        $this->signIn('owner');
        $this->seedMasterCatalog();

        $device = $this->createDevice([
            'metadata' => [
                'brand_id' => 'brand-apple',
                'device_model_id' => 'model-iphone-11',
                'serial_or_imei' => 'OLD_SERIAL',
                'powers_on' => 'No',
                'account_lock' => 'Unknown',
                'description' => 'Original',
            ],
        ]);

        // Stock recount adjustment recorded
        DB::table('inventory_stock_adjustments')->insert([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $device->id,
            'request_id' => (string) Str::uuid(),
            'quantity_before' => 1,
            'quantity_delta' => 0,
            'quantity_after' => 1,
            'reason' => 'Recuento mensual de depósito',
            'actor_id' => (string) Str::ulid(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Updating physical attributes succeeds
        $this->patchJson('/api/v1/admin/inventory/' . $device->id, [
            'brand_id' => 'brand-apple',
            'device_model_id' => 'model-iphone-11',
            'serial_or_imei' => '359999888877776',
            'powers_on' => 'Yes',
            'account_lock' => 'Clear',
            'description' => 'Notas físicas actualizadas tras peritaje',
            'currency_code' => 'UYU',
        ])->assertOk();

        $fresh = $device->fresh();
        $this->assertSame('359999888877776', $fresh->metadata['serial_or_imei']);
        $this->assertSame('Yes', $fresh->metadata['powers_on']);
        $this->assertSame('Clear', $fresh->metadata['account_lock']);
        $this->assertSame('Notas físicas actualizadas tras peritaje', $fresh->description);
    }

    /**
     * Requirement 9:
     * Venta cerrada protege identidad y campos financieros.
     */
    public function test_closed_sale_protects_identity_and_financial_fields(): void
    {
        $this->signIn('owner');
        $this->seedMasterCatalog();

        $device = $this->createDevice([
            'operational_status' => 'vendido',
            'cost_amount_minor' => 300000,
            'currency_code' => 'UYU',
            'metadata' => [
                'brand_id' => 'brand-apple',
                'device_model_id' => 'model-iphone-11',
                'storage_capacity_id' => null,
                'serial_or_imei' => '351234567890123',
                'powers_on' => 'Yes',
                'account_lock' => 'Clear',
                'acquisition_source' => 'Cliente directo',
            ],
        ]);

        DB::table('device_sale_records')->insert([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $device->id,
            'effective_sale_price_minor' => 450000,
            'currency_code' => 'UYU',
            'inventory_purpose' => 'sell_as_used_phone',
            'sold_at' => now(),
            'sold_by_actor_id' => (string) Str::ulid(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Attempting to change identity is rejected (409)
        $this->patchJson('/api/v1/admin/inventory/' . $device->id, [
            'brand_id' => 'brand-apple',
            'device_model_id' => 'model-iphone-11-pro',
            'powers_on' => 'Yes',
            'account_lock' => 'Clear',
            'currency_code' => 'UYU',
        ])->assertStatus(409)
            ->assertJsonPath('detail', 'No se puede modificar la identidad de un equipo vendido o con venta registrada.');

        // Attempting to change cost is rejected (409)
        $this->patchJson('/api/v1/admin/inventory/' . $device->id, [
            'brand_id' => 'brand-apple',
            'device_model_id' => 'model-iphone-11',
            'cost_amount_minor' => 100000,
            'powers_on' => 'Yes',
            'account_lock' => 'Clear',
            'currency_code' => 'UYU',
        ])->assertStatus(409)
            ->assertJsonPath('detail', 'No se pueden modificar los datos financieros o de adquisición de un equipo vendido o con venta registrada.');

        // Attempting to change commercial sale price on sold item is rejected (409)
        $this->patchJson('/api/v1/admin/inventory/phones/' . $device->id . '/publication', [
            'title' => 'iPhone 11',
            'description' => 'Teléfono vendido con anterioridad.',
            'price_minor' => 999999,
            'currency' => 'UYU',
            'published' => false,
        ])->assertStatus(409)
            ->assertJsonPath('detail', 'No se puede modificar el precio comercial de un equipo vendido o con venta registrada.');

        // But resending existing identity & financial values to correct physical attributes succeeds!
        $this->patchJson('/api/v1/admin/inventory/' . $device->id, [
            'brand_id' => 'brand-apple',
            'device_model_id' => 'model-iphone-11',
            'storage_capacity_id' => 'storage-128',
            'description' => 'Almacenamiento completado retroactivamente tras auditoría física.',
            'cost_amount_minor' => 300000,
            'acquisition_source' => 'Cliente directo',
            'powers_on' => 'Yes',
            'account_lock' => 'Clear',
            'currency_code' => 'UYU',
        ])->assertOk();

        $fresh = $device->fresh();
        $this->assertSame('storage-128', $fresh->metadata['storage_capacity_id']);
        $this->assertSame('Almacenamiento completado retroactivamente tras auditoría física.', $fresh->description);
    }

    /**
     * Requirement 10:
     * Pedido abierto protege únicamente lo que corresponda (identidad, costo, precio),
     * permitiendo actualizar atributos físicos.
     */
    public function test_open_order_protects_only_appropriate_fields(): void
    {
        $this->signIn('owner');
        $this->seedMasterCatalog();

        $device = $this->createDevice([
            'cost_amount_minor' => 300000,
            'sale_price_amount_minor' => 450000,
            'currency_code' => 'UYU',
            'metadata' => [
                'brand_id' => 'brand-apple',
                'device_model_id' => 'model-iphone-11',
                'storage_capacity_id' => null,
                'powers_on' => 'Yes',
                'account_lock' => 'Clear',
            ],
        ]);

        $customerId = (string) Str::ulid();
        DB::table('crm_customers')->insert([
            'id' => $customerId,
            'full_name' => 'Cliente Pedido',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $orderId = (string) Str::ulid();
        DB::table('orders')->insert([
            'id' => $orderId,
            'order_number' => 'ORD-1001',
            'customer_id' => $customerId,
            'customer_name_snapshot' => 'Cliente Pedido',
            'status' => 'pending',
            'total_amount_minor' => 450000,
            'currency_code' => 'UYU',
            'created_by_actor_id' => 'operator',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('order_items')->insert([
            'id' => (string) Str::ulid(),
            'order_id' => $orderId,
            'inventory_item_id' => $device->id,
            'item_name_snapshot' => 'iPhone 11',
            'item_type_snapshot' => 'used_phone',
            'quantity' => 1,
            'unit_price_minor' => 450000,
            'line_total_minor' => 450000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Identity change is protected while committed to open order
        $this->patchJson('/api/v1/admin/inventory/' . $device->id, [
            'brand_id' => 'brand-apple',
            'device_model_id' => 'model-iphone-11-pro',
            'powers_on' => 'Yes',
            'account_lock' => 'Clear',
            'currency_code' => 'UYU',
        ])->assertStatus(409)
            ->assertJsonPath('detail', 'No se puede modificar la identidad de un equipo reservado en un pedido comercial abierto.');

        // Acquisition cost change is protected while in open order
        $this->patchJson('/api/v1/admin/inventory/' . $device->id, [
            'brand_id' => 'brand-apple',
            'device_model_id' => 'model-iphone-11',
            'cost_amount_minor' => 200000,
            'powers_on' => 'Yes',
            'account_lock' => 'Clear',
            'currency_code' => 'UYU',
        ])->assertStatus(409)
            ->assertJsonPath('detail', 'No se pueden modificar los datos financieros o de adquisición de un equipo reservado en un pedido comercial abierto.');

        // Commercial price change is protected while reserved in open order
        $this->patchJson('/api/v1/admin/inventory/phones/' . $device->id . '/publication', [
            'title' => 'iPhone 11',
            'description' => 'Modificación de precio intentada.',
            'price_minor' => 390000,
            'currency' => 'UYU',
            'published' => false,
        ])->assertStatus(409)
            ->assertJsonPath('detail', 'No se puede modificar el precio comercial de un equipo reservado en un pedido comercial abierto.');

        // But updating physical attributes (storage, serial, description) succeeds!
        $this->patchJson('/api/v1/admin/inventory/' . $device->id, [
            'brand_id' => 'brand-apple',
            'device_model_id' => 'model-iphone-11',
            'storage_capacity_id' => 'storage-128',
            'serial_or_imei' => '351111222233334',
            'powers_on' => 'Yes',
            'account_lock' => 'Clear',
            'currency_code' => 'UYU',
        ])->assertOk();

        $this->assertSame('storage-128', $device->fresh()->metadata['storage_capacity_id']);
        $this->assertSame('351111222233334', $device->fresh()->metadata['serial_or_imei']);
    }

    /**
     * Requirement 11:
     * Update sin cambios reales no crea auditoría inútil.
     */
    public function test_update_without_real_changes_does_not_create_useless_audit_event(): void
    {
        $this->signIn('owner');
        $this->seedMasterCatalog();

        $device = $this->createDevice([
            'cost_amount_minor' => 300000,
            'currency_code' => 'UYU',
            'description' => 'Sin cambios',
            'metadata' => [
                'brand_id' => 'brand-apple',
                'device_model_id' => 'model-iphone-11',
                'storage_capacity_id' => 'storage-128',
                'storage' => '128 GB',
                'serial_or_imei' => '351234567890123',
                'powers_on' => 'Yes',
                'account_lock' => 'Clear',
                'acquisition_source' => 'Cliente',
            ],
        ]);

        $auditCountBefore = DB::table('audit_events')->where('entity_id', $device->id)->count();

        // Resend identical values
        $this->patchJson('/api/v1/admin/inventory/' . $device->id, [
            'brand_id' => 'brand-apple',
            'device_model_id' => 'model-iphone-11',
            'storage_capacity_id' => 'storage-128',
            'serial_or_imei' => '351234567890123',
            'powers_on' => 'Yes',
            'account_lock' => 'Clear',
            'acquisition_source' => 'Cliente',
            'cost_amount_minor' => 300000,
            'currency_code' => 'UYU',
            'description' => 'Sin cambios',
        ])->assertOk();

        $auditCountAfter = DB::table('audit_events')->where('entity_id', $device->id)->count();
        $this->assertSame($auditCountBefore, $auditCountAfter);
    }

    /**
     * Requirement 12:
     * Destroy mantiene sus guardas estrictas.
     */
    public function test_destroy_maintains_its_strict_guards(): void
    {
        $this->signIn('owner');
        $this->seedMasterCatalog();

        $device = $this->createDevice([
            'is_sellable' => false,
            'publication_status' => 'no_publicable',
        ]);

        // 1. Device with installed parts cannot be deleted
        $partId = (string) Str::ulid();
        DB::table('device_installed_parts')->insert([
            'id' => $partId,
            'inventory_item_id' => $device->id,
            'part_name' => 'Pantalla',
            'cost_amount_minor' => 50000,
            'currency_code' => 'UYU',
            'installed_at' => now(),
            'installed_by_actor_id' => 'test-operator',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->deleteJson('/api/v1/admin/inventory/' . $device->id)->assertStatus(409);
        DB::table('device_installed_parts')->where('id', $partId)->delete();

        // 2. Published device cannot be deleted
        $device->publication_status = 'publicado';
        $device->save();
        $this->deleteJson('/api/v1/admin/inventory/' . $device->id)->assertStatus(409);
        $device->publication_status = 'no_publicable';
        $device->save();

        // 3. Clean non-sellable device can be deleted (logical deletion)
        $this->deleteJson('/api/v1/admin/inventory/' . $device->id)->assertOk();
        $this->assertSoftDeleted('inventory_items', ['id' => $device->id]);
    }

    /**
     * Requirement 13:
     * Reglas de titularidad existentes continúan funcionando.
     */
    public function test_existing_ownership_rules_continue_functioning(): void
    {
        $this->signIn('owner');
        $this->seedMasterCatalog();

        $device = $this->createDevice([
            'metadata' => [
                'brand_id' => 'brand-apple',
                'device_model_id' => 'model-iphone-11',
                'destination' => 'Refurbish',
                'powers_on' => 'Yes',
                'account_lock' => 'Clear',
            ],
        ]);

        $consignorId = (string) Str::ulid();
        DB::table('consignors')->insert([
            'id' => $consignorId,
            'full_name' => 'Consignante Titularidad',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Change ownership to consignment requires at least 10 characters reason
        $this->patchJson('/api/v1/admin/inventory/' . $device->id, [
            'brand_id' => 'brand-apple',
            'device_model_id' => 'model-iphone-11',
            'powers_on' => 'Yes',
            'account_lock' => 'Clear',
            'currency_code' => 'UYU',
            'ownership_type' => 'consignment',
            'consignor_id' => $consignorId,
            'ownership_correction_reason' => 'corto',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['ownership_correction_reason']);

        // Change ownership to consignment requires registered consignor
        $this->patchJson('/api/v1/admin/inventory/' . $device->id, [
            'brand_id' => 'brand-apple',
            'device_model_id' => 'model-iphone-11',
            'powers_on' => 'Yes',
            'account_lock' => 'Clear',
            'currency_code' => 'UYU',
            'ownership_type' => 'consignment',
            'consignor_id' => null,
            'ownership_correction_reason' => 'Motivo suficientemente explicativo.',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['consignor_id']);

        // Valid correction to consignment succeeds
        $this->patchJson('/api/v1/admin/inventory/' . $device->id, [
            'brand_id' => 'brand-apple',
            'device_model_id' => 'model-iphone-11',
            'powers_on' => 'Yes',
            'account_lock' => 'Clear',
            'currency_code' => 'UYU',
            'ownership_type' => 'consignment',
            'consignor_id' => $consignorId,
            'ownership_correction_reason' => 'Ingresado por error como propiedad de la empresa.',
        ])->assertOk();

        $this->assertSame($consignorId, $device->fresh()->consignor_id);
        $this->assertSame('consignation', $device->fresh()->inventory_purpose);
    }
}
