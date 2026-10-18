<?php

namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\Media\InventoryItemPhoto;
use App\Infrastructure\Media\InventoryItemPromotionalAsset;
use App\Infrastructure\Media\MediaStorageProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class DevicePromotionalAssetsTest extends TestCase
{
    use RefreshDatabase;

    private function auth(string $role = 'owner'): User
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => 'Ad Manager',
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

    private function device(array $overrides = []): InventoryItem
    {
        return InventoryItem::query()->create(array_merge([
            'sku' => 'FXP-0009',
            'title' => 'iPhone 11 128GB Negro',
            'item_type' => 'used_phone',
            'brand' => 'Apple',
            'model' => 'iPhone 11',
            'operational_status' => 'disponible',
            'publication_status' => 'publicado',
            'inventory_purpose' => 'sell_as_used_phone',
            'is_sellable' => true,
            'stock_quantity' => 1,
            'sale_price_amount_minor' => 35000,
            'currency_code' => 'USD',
            'metadata' => [
                'storage' => '128 GB',
                'ram' => '4 GB',
                'color' => 'Negro',
                'condition_name' => 'Excelente',
                'defects' => 'Microrrayón en bisel inferior',
                'warranty' => '3 meses FixPhone',
            ],
        ], $overrides));
    }

    private function photo(string $deviceId, string $status = 'confirmed'): InventoryItemPhoto
    {
        $profile = MediaStorageProfile::query()->first() ?? $this->profile();
        return InventoryItemPhoto::query()->create([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $deviceId,
            'media_storage_profile_id' => $profile->id,
            'object_key' => 'inventory/devices/' . $deviceId . '/photo.webp',
            'public_url' => 'https://cdn.fixphone.test/inventory/devices/' . $deviceId . '/photo.webp',
            'content_type' => 'image/webp',
            'byte_size' => 1024,
            'status' => $status,
            'sort_order' => 0,
            'is_primary' => true,
            'upload_expires_at' => now()->addHour(),
        ]);
    }

    private function profile(): MediaStorageProfile
    {
        return MediaStorageProfile::query()->create([
            'name' => 'R2 Ads',
            'provider' => 'r2',
            'bucket' => 'fixphone-ads',
            'endpoint_url' => 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com',
            'public_base_url' => 'https://cdn.fixphone.test',
            'object_prefix' => 'media',
            'access_key_id_encrypted' => Crypt::encryptString('mock-key'),
            'secret_access_key_encrypted' => Crypt::encryptString('mock-secret'),
            'is_selected' => true,
        ]);
    }

    private function ensurePrompt(): void
    {
        $existing = DB::table('ai_prompts')->where('code', 'PROMPT-0001')->first();
        $content = "# Contexto\nEres publicista FixPhone.\n\n# Datos del dispositivo\n- Dispositivo: {{modelo}} ({{codigo_fxp}})\n- Memoria RAM: {{ram}}\n- Almacenamiento: {{almacenamiento}}\n- Color: {{color}}\n- Condición física: {{condicion}}\n- Precio: {{precio}} {{moneda}}\n- Características destacadas: {{caracteristicas_destacadas}}\n- Defectos: {{defectos}}\n- Garantía: {{garantia}}\n\n# Instrucción\nGenerar publicidad sobria.";
        if (!$existing) {
            DB::table('ai_prompts')->insert([
                'id' => (string) Str::ulid(),
                'code' => 'PROMPT-0001',
                'description' => 'Publicidad de dispositivo FixPhone',
                'version' => '1.0',
                'lock_version' => 1,
                'content' => $content,
                'archived_at' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } else {
            DB::table('ai_prompts')->where('code', 'PROMPT-0001')->update([
                'content' => $content,
                'version' => '1.0',
                'archived_at' => null,
                'updated_at' => now(),
            ]);
        }
    }

    public function test_authorization_checks(): void
    {
        $device = $this->device();
        $this->ensurePrompt();
        $photo = $this->photo($device->id);

        // Guest is unauthorized
        $this->getJson("/api/v1/admin/inventory/{$device->id}/promotional-assets")->assertUnauthorized();

        // intake_operator has inventory.view but not catalog.manage
        $this->auth('intake_operator');
        $this->getJson("/api/v1/admin/inventory/{$device->id}/promotional-assets")->assertOk();
        $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/prepare", [
            'source_photo_id' => $photo->id,
        ])->assertForbidden();
    }

    public function test_prepare_promotional_asset_from_valid_real_photo(): void
    {
        $this->auth('owner');
        $this->ensurePrompt();
        $device = $this->device();
        $photo = $this->photo($device->id);

        $res = $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/prepare", [
            'source_photo_id' => $photo->id,
        ])->assertCreated();

        $data = $res->json('data');
        $this->assertEquals('prepared', $data['status']);
        $this->assertEquals($photo->id, $data['source_photo_id']);
        $this->assertEquals($photo->public_url, $data['source_photo_url']);
        $this->assertEquals('PROMPT-0001', $data['prompt_code']);
        $this->assertEquals('1.0', $data['prompt_version']);

        // Check snapshot contents
        $snapshot = $data['prompt_snapshot'];
        $this->assertStringContainsString('Apple iPhone 11 (FXP-0009)', $snapshot);
        $this->assertStringContainsString('Memoria RAM: 4 GB', $snapshot);
        $this->assertStringContainsString('Almacenamiento: 128 GB', $snapshot);
        $this->assertStringContainsString('Color: Negro', $snapshot);
        $this->assertStringContainsString('Condición física: Excelente', $snapshot);
        $this->assertStringContainsString('Precio: 350 USD', $snapshot);
        $this->assertStringContainsString('Defectos: Microrrayón en bisel inferior', $snapshot);
        $this->assertStringContainsString('Garantía: 3 meses FixPhone', $snapshot);

        // Check that promotional asset is persisted in independent table
        $this->assertDatabaseHas('inventory_item_promotional_assets', [
            'id' => $data['id'],
            'inventory_item_id' => $device->id,
            'source_photo_id' => $photo->id,
            'status' => 'prepared',
        ]);

        // inventory_item_photos is NOT polluted
        $this->assertEquals(1, InventoryItemPhoto::query()->where('inventory_item_id', $device->id)->count());
    }

    public function test_reject_source_photo_from_another_device(): void
    {
        $this->auth('owner');
        $this->ensurePrompt();
        $deviceA = $this->device(['sku' => 'FXP-A']);
        $deviceB = $this->device(['sku' => 'FXP-B']);
        $photoB = $this->photo($deviceB->id);

        $this->postJson("/api/v1/admin/inventory/{$deviceA->id}/promotional-assets/prepare", [
            'source_photo_id' => $photoB->id,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('source_photo_id')
            ->assertJsonPath('errors.source_photo_id.0', 'La fotografía fuente pertenece a otro dispositivo.');
    }

    public function test_reject_nonexistent_or_unconfirmed_source_photo(): void
    {
        $this->auth('owner');
        $this->ensurePrompt();
        $device = $this->device();
        $pendingPhoto = $this->photo($device->id, 'pending');

        // Unconfirmed photo
        $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/prepare", [
            'source_photo_id' => $pendingPhoto->id,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('source_photo_id');

        // Non-existent photo
        $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/prepare", [
            'source_photo_id' => (string) Str::ulid(),
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('source_photo_id');
    }

    public function test_reject_when_prompt_0001_is_missing_or_archived(): void
    {
        $this->auth('owner');
        $device = $this->device();
        $photo = $this->photo($device->id);

        // 1. Missing PROMPT-0001: clean up revisions first so foreign key is respected
        $promptId = DB::table('ai_prompts')->where('code', 'PROMPT-0001')->value('id');
        if ($promptId) {
            DB::table('ai_prompt_revisions')->where('ai_prompt_id', $promptId)->delete();
        }
        DB::table('ai_prompts')->where('code', 'PROMPT-0001')->delete();

        $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/prepare", [
            'source_photo_id' => $photo->id,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('prompt');

        // 2. Archived PROMPT-0001
        $this->ensurePrompt();
        DB::table('ai_prompts')->where('code', 'PROMPT-0001')->update(['archived_at' => now()]);

        $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/prepare", [
            'source_photo_id' => $photo->id,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('prompt');
    }

    public function test_variable_resolution_omits_missing_data_without_fabrication(): void
    {
        $this->auth('owner');
        $this->ensurePrompt();

        // Device without RAM, without defects, without warranty, without price
        $device = $this->device([
            'sale_price_amount_minor' => null,
            'metadata' => [
                'storage' => '64 GB',
                // No ram
                'color' => 'Blanco',
                'condition_name' => 'Bueno',
                // No defects
                // No warranty
            ],
        ]);
        $photo = $this->photo($device->id);

        $res = $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/prepare", [
            'source_photo_id' => $photo->id,
        ])->assertCreated();

        $snapshot = $res->json('data.prompt_snapshot');
        $warnings = $res->json('warnings');

        // Confirm missing items are pruned from snapshot
        $this->assertStringNotContainsString('Memoria RAM', $snapshot);
        $this->assertStringNotContainsString('Precio', $snapshot);
        $this->assertStringNotContainsString('Defectos', $snapshot);
        $this->assertStringNotContainsString('Garantía', $snapshot);
        $this->assertStringNotContainsString('{{', $snapshot); // No dangling tags

        // Confirm present items are preserved
        $this->assertStringContainsString('Almacenamiento: 64 GB', $snapshot);
        $this->assertStringContainsString('Color: Blanco', $snapshot);
        $this->assertStringContainsString('Condición física: Bueno', $snapshot);

        // Confirm non-blocking warnings are reported
        $this->assertContains('No hay precio publicado o configurado para el dispositivo.', $warnings);
        $this->assertContains('Memoria RAM ausente en el registro físico del dispositivo.', $warnings);
    }

    public function test_absent_currency_never_produces_usd_and_omits_commercial_block(): void
    {
        $this->auth('owner');
        $this->ensurePrompt();

        // Device has price 350.00 but NO currency_code (empty string)
        $device = $this->device([
            'sale_price_amount_minor' => 35000,
            'currency_code' => '',
            'metadata' => [
                'storage' => '128 GB',
                'ram' => '6 GB',
                'color' => 'Azul',
                'condition_name' => 'Excelente',
            ],
        ]);
        $photo = $this->photo($device->id);

        $res = $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/prepare", [
            'source_photo_id' => $photo->id,
        ])->assertCreated();

        $snapshot = $res->json('data.prompt_snapshot');
        $warnings = $res->json('warnings');
        $summary = $res->json('device_summary');

        // Explicit assertion: absent currency NEVER produces "USD"
        $this->assertStringNotContainsString('USD', $snapshot);
        $this->assertNull($summary['moneda']);
        $this->assertEquals('350', $summary['precio']);

        // Explicit warning must be generated
        $this->assertContains('Moneda no especificada para el precio del dispositivo.', $warnings);

        // Commercial price line is omitted safely from the prompt so no false currency is attributed
        $this->assertStringNotContainsString('Precio:', $snapshot);

        // Also test directly on resolver with null currency_code
        $resolver = new \App\Application\PromotionalAssets\DevicePromptVariableResolver();
        $itemWithNull = new InventoryItem(['sale_price_amount_minor' => 20000, 'currency_code' => null]);
        $resolved = $resolver->resolve($itemWithNull);
        $this->assertNull($resolved['variables']['moneda']);
        $this->assertNull($resolved['summary']['moneda']);
        $this->assertContains('Moneda no especificada para el precio del dispositivo.', $resolved['warnings']);
    }

    public function test_representative_real_prompt_preserves_instructions_while_omitting_empty_data(): void
    {
        $this->auth('owner');

        $representativePrompt = <<<'PROMPT_TEXT'
# Contexto
Eres un especialista en diseño publicitario y marketing para FixPhone.

# Datos disponibles:
- Dispositivo: {{modelo}} ({{codigo_fxp}})
RAM: {{ram}}
Almacenamiento: {{almacenamiento}}
Color: {{color}}
Condición física: {{condicion}}
Precio: {{precio}} {{moneda}}
Garantía: {{garantia}}
Defectos: {{defectos}}

# Reglas obligatorias de fidelidad y seguridad:
Si un dato está vacío, omítelo. No lo inventes ni intentes deducirlo de la fotografía.
Si existen defectos importantes proporcionados en {{defectos}}, no deben ocultarse ni contradecirse visualmente.
Genera una publicidad de impacto comercial con iluminación de estudio y fondo profesional.
PROMPT_TEXT;

        $existing = DB::table('ai_prompts')->where('code', 'PROMPT-0001')->first();
        if ($existing) {
            DB::table('ai_prompts')->where('code', 'PROMPT-0001')->update([
                'content' => $representativePrompt,
                'version' => '1.0',
                'archived_at' => null,
                'updated_at' => now(),
            ]);
        } else {
            DB::table('ai_prompts')->insert([
                'id' => (string) Str::ulid(),
                'code' => 'PROMPT-0001',
                'description' => 'Publicidad de dispositivo FixPhone',
                'version' => '1.0',
                'lock_version' => 1,
                'content' => $representativePrompt,
                'archived_at' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // Device without RAM, and without defects
        $device = $this->device([
            'sku' => 'FXP-0010',
            'title' => 'iPhone 12 Pro',
            'sale_price_amount_minor' => 45000,
            'currency_code' => 'USD',
            'metadata' => [
                'storage' => '256 GB',
                // No ram
                'color' => 'Grafito',
                'condition_name' => 'Excelente',
                'warranty' => '6 meses FixPhone',
                // No defects
            ],
        ]);
        $photo = $this->photo($device->id);

        $res = $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/prepare", [
            'source_photo_id' => $photo->id,
        ])->assertCreated();

        $snapshot = $res->json('data.prompt_snapshot');

        // 1. No se inventa RAM (data line omitted)
        $this->assertStringNotContainsString('RAM:', $snapshot);
        $this->assertStringNotContainsString('8 GB', $snapshot);
        $this->assertStringNotContainsString('desconocida', $snapshot);

        // 2. No quedan placeholders comerciales incorrectos
        $this->assertStringNotContainsString('{{ram}}', $snapshot);
        $this->assertStringNotContainsString('{{almacenamiento}}', $snapshot);
        $this->assertStringNotContainsString('{{defectos}}', $snapshot);
        $this->assertStringNotContainsString('{{precio}}', $snapshot);
        $this->assertStringNotContainsString('{{moneda}}', $snapshot);
        $this->assertStringNotContainsString('{{', $snapshot);

        // 3. NO desaparecen las instrucciones de seguridad/fidelidad
        $this->assertStringContainsString('Si un dato está vacío, omítelo. No lo inventes ni intentes deducirlo de la fotografía.', $snapshot);
        $this->assertStringContainsString('Si existen defectos importantes proporcionados en (ninguno declarado), no deben ocultarse ni contradecirse visualmente.', $snapshot);
        $this->assertStringContainsString('Genera una publicidad de impacto comercial con iluminación de estudio y fondo profesional.', $snapshot);

        // 4. Present data is properly resolved
        $this->assertStringContainsString('Almacenamiento: 256 GB', $snapshot);
        $this->assertStringContainsString('Color: Grafito', $snapshot);
        $this->assertStringContainsString('Precio: 450 USD', $snapshot);
        $this->assertStringContainsString('Garantía: 6 meses FixPhone', $snapshot);

        // 5. El snapshot continúa siendo utilizable como prompt completo
        $this->assertStringContainsString('# Contexto', $snapshot);
        $this->assertStringContainsString('# Datos disponibles:', $snapshot);
        $this->assertStringContainsString('# Reglas obligatorias de fidelidad y seguridad:', $snapshot);
    }

    public function test_snapshot_remains_immutable_even_if_prompt_changes_later(): void
    {
        $this->auth('owner');
        $this->ensurePrompt();
        $device = $this->device();
        $photo = $this->photo($device->id);

        $res = $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/prepare", [
            'source_photo_id' => $photo->id,
        ])->assertCreated();

        $originalSnapshot = $res->json('data.prompt_snapshot');
        $assetId = $res->json('data.id');

        // Simulate subsequent prompt revision/change in database
        DB::table('ai_prompts')->where('code', 'PROMPT-0001')->update([
            'content' => 'Completely new prompt content v2.0',
            'version' => '2.0',
        ]);

        $fetched = $this->getJson("/api/v1/admin/inventory/{$device->id}/promotional-assets")->assertOk();
        $asset = collect($fetched->json('data'))->firstWhere('id', $assetId);

        // The historical asset snapshot must be untouched
        $this->assertEquals($originalSnapshot, $asset['prompt_snapshot']);
        $this->assertEquals('1.0', $asset['prompt_version']);
    }

    public function test_presign_and_confirm_upload_flow(): void
    {
        $this->auth('owner');
        $this->profile();
        $this->ensurePrompt();
        $device = $this->device();
        $photo = $this->photo($device->id);

        $prepareRes = $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/prepare", [
            'source_photo_id' => $photo->id,
        ])->assertCreated();

        $assetId = $prepareRes->json('data.id');

        // Presign upload URL
        $presignRes = $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/{$assetId}/presign", [
            'content_type' => 'image/webp',
            'byte_size' => 2048,
        ])->assertOk();

        $uploadUrl = $presignRes->json('data.upload_url');
        // Storage path must use promotional prefix
        $this->assertStringContainsString("/inventory/devices/{$device->id}/promotional/{$assetId}.webp", $uploadUrl);

        // Mock R2 HEAD response
        Http::fake([
            '*' => Http::response('', 200, [
                'Content-Length' => '2048',
                'Content-Type' => 'image/webp',
            ]),
        ]);

        // Confirm upload
        $confirmRes = $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/{$assetId}/confirm")
            ->assertOk();

        $this->assertEquals('uploaded', $confirmRes->json('data.status'));
        $this->assertNotNull($confirmRes->json('data.image_url'));
        $this->assertEquals(2048, $confirmRes->json('data.size_bytes'));
    }

    public function test_reject_invalid_mime_and_too_large_size(): void
    {
        $this->auth('owner');
        $this->profile();
        $this->ensurePrompt();
        $device = $this->device();
        $photo = $this->photo($device->id);

        $prepareRes = $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/prepare", [
            'source_photo_id' => $photo->id,
        ])->assertCreated();
        $assetId = $prepareRes->json('data.id');

        // Invalid mime
        $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/{$assetId}/presign", [
            'content_type' => 'application/pdf',
            'byte_size' => 1024,
        ])->assertUnprocessable()->assertJsonValidationErrors('content_type');

        // Exceeds max bytes (5MB)
        $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/{$assetId}/presign", [
            'content_type' => 'image/webp',
            'byte_size' => 6 * 1024 * 1024,
        ])->assertUnprocessable()->assertJsonValidationErrors('byte_size');
    }

    public function test_approve_promotional_asset(): void
    {
        $user = $this->auth('owner');
        $this->ensurePrompt();
        $device = $this->device();
        $photo = $this->photo($device->id);

        $asset = InventoryItemPromotionalAsset::create([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $device->id,
            'source_photo_id' => $photo->id,
            'prompt_code' => 'PROMPT-0001',
            'prompt_version' => '1.0',
            'prompt_snapshot' => 'Sample snapshot',
            'status' => 'uploaded',
            'image_url' => 'https://cdn.fixphone.test/ad.webp',
            'mime_type' => 'image/webp',
            'size_bytes' => 1024,
        ]);

        $res = $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/{$asset->id}/approve")
            ->assertOk();

        $this->assertEquals('approved', $res->json('data.status'));
        $this->assertEquals($user->id, $res->json('data.approved_by'));
        $this->assertNotNull($res->json('data.approved_at'));
    }

    public function test_reject_cross_device_asset_actions(): void
    {
        $this->auth('owner');
        $this->ensurePrompt();
        $deviceA = $this->device(['sku' => 'FXP-A']);
        $deviceB = $this->device(['sku' => 'FXP-B']);
        $photoB = $this->photo($deviceB->id);

        $assetB = InventoryItemPromotionalAsset::create([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $deviceB->id,
            'source_photo_id' => $photoB->id,
            'prompt_code' => 'PROMPT-0001',
            'prompt_version' => '1.0',
            'prompt_snapshot' => 'Snapshot B',
            'status' => 'uploaded',
        ]);

        // Attempting to approve assetB through deviceA route must return 404
        $this->postJson("/api/v1/admin/inventory/{$deviceA->id}/promotional-assets/{$assetB->id}/approve")
            ->assertNotFound();
    }

    public function test_discard_promotional_asset(): void
    {
        $this->auth('owner');
        $this->profile();
        $this->ensurePrompt();
        $device = $this->device();
        $photo = $this->photo($device->id);
        $profile = MediaStorageProfile::query()->first();

        $asset = InventoryItemPromotionalAsset::create([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $device->id,
            'source_photo_id' => $photo->id,
            'prompt_code' => 'PROMPT-0001',
            'prompt_version' => '1.0',
            'prompt_snapshot' => 'Snapshot to discard',
            'status' => 'uploaded',
            'media_storage_profile_id' => $profile->id,
            'object_key' => 'media/inventory/devices/' . $device->id . '/promotional/trash.webp',
            'image_url' => 'https://cdn.fixphone.test/media/inventory/devices/' . $device->id . '/promotional/trash.webp',
            'mime_type' => 'image/webp',
            'size_bytes' => 1024,
        ]);

        Http::fake(['*' => Http::response('', 204)]);

        $res = $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/{$asset->id}/discard")
            ->assertOk();

        $this->assertEquals('discarded', $res->json('data.status'));
        $this->assertDatabaseHas('inventory_item_promotional_assets', [
            'id' => $asset->id,
            'status' => 'discarded',
        ]);
    }

    public function test_prepare_is_idempotent_and_reuses_active_prepared_asset(): void
    {
        $this->auth('owner');
        $this->ensurePrompt();
        $device = $this->device();
        $photo = $this->photo($device->id);

        // 1st request -> creates new prepared asset (201)
        $res1 = $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/prepare", [
            'source_photo_id' => $photo->id,
        ])->assertCreated();

        $assetId1 = $res1->json('data.id');
        $this->assertNotEmpty($assetId1);
        $this->assertEquals(1, InventoryItemPromotionalAsset::query()->where('inventory_item_id', $device->id)->count());

        // 2nd consecutive identical request -> reuses existing prepared asset (200), no duplicates
        $res2 = $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/prepare", [
            'source_photo_id' => $photo->id,
        ])->assertOk();

        $assetId2 = $res2->json('data.id');
        $this->assertEquals($assetId1, $assetId2);
        $this->assertEquals(1, InventoryItemPromotionalAsset::query()->where('inventory_item_id', $device->id)->count());
    }

    public function test_prepare_creates_new_asset_if_source_photo_changes(): void
    {
        $this->auth('owner');
        $this->ensurePrompt();
        $device = $this->device();
        $photo1 = $this->photo($device->id);
        $photo2 = InventoryItemPhoto::query()->create([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $device->id,
            'media_storage_profile_id' => $photo1->media_storage_profile_id,
            'object_key' => 'inventory/devices/' . $device->id . '/photo2.webp',
            'public_url' => 'https://cdn.fixphone.test/inventory/devices/' . $device->id . '/photo2.webp',
            'content_type' => 'image/webp',
            'byte_size' => 2048,
            'status' => 'confirmed',
            'sort_order' => 1,
            'is_primary' => false,
            'upload_expires_at' => now()->addHour(),
        ]);

        $res1 = $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/prepare", [
            'source_photo_id' => $photo1->id,
        ])->assertCreated();

        $res2 = $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/prepare", [
            'source_photo_id' => $photo2->id,
        ])->assertCreated();

        $this->assertNotEquals($res1->json('data.id'), $res2->json('data.id'));
        $this->assertEquals(2, InventoryItemPromotionalAsset::query()->where('inventory_item_id', $device->id)->count());
    }

    public function test_prepare_creates_new_asset_if_prompt_version_changes(): void
    {
        $this->auth('owner');
        $this->ensurePrompt();
        $device = $this->device();
        $photo = $this->photo($device->id);

        $res1 = $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/prepare", [
            'source_photo_id' => $photo->id,
        ])->assertCreated();
        $this->assertEquals('1.0', $res1->json('data.prompt_version'));

        // Update prompt version
        DB::table('ai_prompts')->where('code', 'PROMPT-0001')->update([
            'version' => '2.0',
        ]);

        $res2 = $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/prepare", [
            'source_photo_id' => $photo->id,
        ])->assertCreated();
        $this->assertEquals('2.0', $res2->json('data.prompt_version'));

        $this->assertNotEquals($res1->json('data.id'), $res2->json('data.id'));
        $this->assertEquals(2, InventoryItemPromotionalAsset::query()->where('inventory_item_id', $device->id)->count());
    }

    public function test_prepare_does_not_reuse_uploaded_approved_or_discarded_assets(): void
    {
        $this->auth('owner');
        $this->ensurePrompt();
        $device = $this->device();
        $photo = $this->photo($device->id);

        // Seed an asset in uploaded status
        $uploadedAsset = InventoryItemPromotionalAsset::create([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $device->id,
            'source_photo_id' => $photo->id,
            'prompt_code' => 'PROMPT-0001',
            'prompt_version' => '1.0',
            'prompt_snapshot' => 'Snapshot 1',
            'status' => 'uploaded',
        ]);

        // prepare must NOT reuse uploaded asset, must create fresh prepared asset
        $res1 = $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/prepare", [
            'source_photo_id' => $photo->id,
        ])->assertCreated();
        $this->assertNotEquals($uploadedAsset->id, $res1->json('data.id'));
        $this->assertEquals('prepared', $res1->json('data.status'));

        // Update the new asset to approved
        InventoryItemPromotionalAsset::where('id', $res1->json('data.id'))->update(['status' => 'approved']);

        // prepare must NOT reuse approved asset
        $res2 = $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/prepare", [
            'source_photo_id' => $photo->id,
        ])->assertCreated();
        $this->assertNotEquals($res1->json('data.id'), $res2->json('data.id'));

        // Update newest asset to discarded
        InventoryItemPromotionalAsset::where('id', $res2->json('data.id'))->update(['status' => 'discarded']);

        // prepare must NOT reuse discarded asset
        $res3 = $this->postJson("/api/v1/admin/inventory/{$device->id}/promotional-assets/prepare", [
            'source_photo_id' => $photo->id,
        ])->assertCreated();
        $this->assertNotEquals($res2->json('data.id'), $res3->json('data.id'));
    }
}

