<?php

namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\MasterData\DeviceModelMedia;
use App\Infrastructure\MasterData\DeviceModelSpec;
use App\Infrastructure\MasterData\DeviceModelVariant;
use App\Infrastructure\MasterData\MasterDataEntry;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * PR 1 · model / variant normalization, inheritance and integrity.
 * Everything here uses the LOCAL database only; DeviceSpecsAPI is never involved.
 */
final class DeviceModelNormalizationPr1Test extends TestCase
{
    use RefreshDatabase;

    private const MIGRATION = 'database/migrations/2026_10_18_000001_add_variant_to_device_model_media.php';

    private function signIn(string $role): void
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(), 'name' => $role,
            'email' => (string) Str::ulid().'@fixphone.test',
            'password' => Hash::make('test-password'), 'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => $role]);
        Sanctum::actingAs($user);
    }

    private function catalog(string $id, string $kind, array $payload): string
    {
        MasterDataEntry::query()->firstOrCreate(['id' => $id], [
            'id' => $id, 'kind' => $kind, 'payload' => ['id' => $id, 'active' => true, ...$payload],
        ]);

        return $id;
    }

    /** @return array{brand:string, model:string, otherModel:string} */
    private function fixtures(): array
    {
        $brand = $this->catalog('brand-apple', 'brands', ['name' => 'Apple']);
        $this->catalog('brand-samsung', 'brands', ['name' => 'Samsung']);
        $model = $this->catalog('model-iphone-13', 'deviceModels', ['brandId' => $brand, 'name' => 'iPhone 13']);
        $other = $this->catalog('model-iphone-14', 'deviceModels', ['brandId' => $brand, 'name' => 'iPhone 14']);
        $this->catalog('ram-6', 'ramCapacities', ['label' => '6 GB']);
        $this->catalog('storage-128', 'storageCapacities', ['label' => '128 GB']);
        $this->catalog('storage-256', 'storageCapacities', ['label' => '256 GB']);

        return ['brand' => $brand, 'model' => $model, 'otherModel' => $other];
    }

    private function variant(string $modelId, string $key = 'v1', array $extra = []): DeviceModelVariant
    {
        return DeviceModelVariant::query()->create(array_merge([
            'device_model_id' => $modelId, 'variant_key' => $key, 'name' => 'Variante '.$key,
        ], $extra));
    }

    private function device(array $attributes = []): InventoryItem
    {
        return InventoryItem::query()->create(array_replace([
            'sku' => 'FXP-'.(string) Str::ulid(), 'title' => 'iPhone', 'item_type' => 'used_phone',
            'brand' => 'Apple', 'model' => 'iPhone 13', 'operational_status' => 'ingresado',
            'publication_status' => 'no_publicable', 'inventory_purpose' => 'internal_use',
            'is_sellable' => false, 'stock_quantity' => 1, 'currency_code' => 'UYU',
        ], $attributes));
    }

    private function editPayload(array $fx, array $extra = []): array
    {
        return array_merge([
            'brand_id' => $fx['brand'], 'device_model_id' => $fx['model'],
            'powers_on' => 'Yes', 'account_lock' => 'Clear', 'currency_code' => 'UYU',
        ], $extra);
    }

    private function intakePayload(array $extra = []): array
    {
        return array_merge([
            'title' => 'iPhone 13', 'item_type' => 'used_phone', 'operational_status' => 'ingresado',
            'publication_status' => 'no_publicable', 'inventory_purpose' => 'internal_use',
        ], $extra);
    }

    // ───────────── Inheritance & separation of inherited vs physical ─────────────

    public function test_variant_overlays_model_specs_and_is_never_copied_into_the_unit(): void
    {
        $fx = $this->fixtures();
        DeviceModelSpec::query()->create(['device_model_id' => $fx['model'], 'specs_json' => ['display' => '6.1"', 'battery' => '3095 mAh']]);
        $variant = $this->variant($fx['model'], 'ram6-128', [
            'ram_capacity_id' => 'ram-6', 'storage_capacity_id' => 'storage-128',
            'differences_json' => ['battery' => '3240 mAh'],
        ]);
        $item = $this->device(['device_model_id' => $fx['model'], 'device_model_variant_id' => $variant->id,
            'metadata' => ['storage_capacity_id' => 'storage-128', 'storage' => '128 GB', 'color' => 'Azul']]);

        $this->signIn('intake_operator');
        $response = $this->getJson('/api/v1/admin/inventory/'.$item->id.'/specifications')->assertOk();
        $response->assertJsonPath('data.identity_source', 'catalog')
            ->assertJsonPath('data.inherited.variant_known', true)
            ->assertJsonPath('data.inherited.model_specs.battery', '3095 mAh')
            ->assertJsonPath('data.inherited.effective.battery', '3240 mAh')
            ->assertJsonPath('data.inherited.effective.display', '6.1"')
            ->assertJsonPath('data.inherited.effective.ram', '6 GB')
            ->assertJsonPath('data.physical.color', 'Azul')
            ->assertJsonPath('data.consistency', []);

        // Reading never writes the sheet into the physical record.
        $this->assertSame(['storage_capacity_id' => 'storage-128', 'storage' => '128 GB', 'color' => 'Azul'], $item->fresh()->metadata);
    }

    public function test_unknown_variant_keeps_unit_data_without_inventing_a_variant(): void
    {
        $fx = $this->fixtures();
        DeviceModelSpec::query()->create(['device_model_id' => $fx['model'], 'specs_json' => ['display' => '6.1"']]);
        $this->variant($fx['model'], 'exists-but-unassigned', ['storage_capacity_id' => 'storage-256']);
        $item = $this->device(['device_model_id' => $fx['model'],
            'metadata' => ['storage_capacity_id' => 'storage-128', 'storage' => '128 GB']]);

        $this->signIn('intake_operator');
        $this->getJson('/api/v1/admin/inventory/'.$item->id.'/specifications')->assertOk()
            ->assertJsonPath('data.inherited.variant_known', false)
            ->assertJsonPath('data.inherited.variant', null)
            ->assertJsonPath('data.inherited.effective.display', '6.1"')
            ->assertJsonPath('data.inherited.effective_specs.display', '6.1"')
            ->assertJsonPath('data.inherited.model_specs.display', '6.1"')
            ->assertJsonPath('data.inherited.inherited_specs.display', '6.1"')
            ->assertJsonMissingPath('data.inherited.effective.storage')
            ->assertJsonMissingPath('data.inherited.effective_specs.storage')
            ->assertJsonPath('data.physical.storage', '128 GB');
        $this->assertNull($item->fresh()->device_model_variant_id);
    }

    public function test_unit_that_contradicts_its_variant_is_flagged_not_overwritten(): void
    {
        $fx = $this->fixtures();
        $variant = $this->variant($fx['model'], 'v256', ['storage_capacity_id' => 'storage-256']);
        $item = $this->device(['device_model_id' => $fx['model'], 'device_model_variant_id' => $variant->id,
            'metadata' => ['storage_capacity_id' => 'storage-128', 'storage' => '128 GB']]);

        $this->signIn('intake_operator');
        $this->getJson('/api/v1/admin/inventory/'.$item->id.'/specifications')->assertOk()
            ->assertJsonPath('data.consistency.0.field', 'storage')
            ->assertJsonPath('data.physical.storage', '128 GB');
        $this->assertSame('128 GB', $item->fresh()->metadata['storage']);
    }

    public function test_historical_unit_without_catalog_reference_is_served_from_legacy_text(): void
    {
        $this->fixtures();
        $item = $this->device(['brand' => 'Apple', 'model' => 'iPhone 13', 'metadata' => ['device_model_id' => 'LEGACY-TEXT-ID']]);

        $this->signIn('intake_operator');
        $this->getJson('/api/v1/admin/inventory/'.$item->id.'/specifications')->assertOk()
            ->assertJsonPath('data.identity_source', 'legacy_text')
            ->assertJsonPath('data.legacy.model', 'iPhone 13')
            ->assertJsonPath('data.inherited', null);
    }

    public function test_specifications_endpoints_enforce_authentication_and_device_only(): void
    {
        $fx = $this->fixtures();
        $device = $this->device();
        $part = $this->device(['item_type' => 'spare_part', 'sku' => 'SP-1']);

        $this->getJson('/api/v1/admin/inventory/'.$device->id.'/specifications')->assertUnauthorized();
        $this->getJson('/api/v1/admin/device-models/'.$fx['model'].'/resolved-specs')->assertUnauthorized();

        $this->signIn('intake_operator');
        $this->getJson('/api/v1/admin/inventory/'.$part->id.'/specifications')->assertStatus(422);
        $this->getJson('/api/v1/admin/device-models/brand-apple/resolved-specs')->assertStatus(422);
    }

    public function test_model_resolver_offers_only_active_variants_and_rejects_foreign_variant(): void
    {
        $fx = $this->fixtures();
        $active = $this->variant($fx['model'], 'active');
        $this->variant($fx['model'], 'retired', ['active' => false]);
        $foreign = $this->variant($fx['otherModel'], 'foreign');

        $this->signIn('intake_operator');
        $response = $this->getJson('/api/v1/admin/device-models/'.$fx['model'].'/resolved-specs')->assertOk();
        $response->assertJsonStructure([
            'data' => [
                'variants' => [['id', 'name', 'variant_key']],
                'resolved' => [
                    'device_model_id',
                    'variant_known',
                    'model_specs',
                    'effective',
                    'inherited_specs',
                    'effective_specs',
                ],
            ],
        ]);
        $this->assertSame([$active->id], array_column($response->json('data.variants'), 'id'));
        $this->getJson('/api/v1/admin/device-models/'.$fx['model'].'/resolved-specs?variant_id='.$foreign->id)->assertStatus(422);
    }

    // ───────────── Central validation across every entry point ─────────────

    public function test_crud_persists_model_and_optional_variant_columns(): void
    {
        $fx = $this->fixtures();
        $variant = $this->variant($fx['model']);
        $item = $this->device(['metadata' => ['origin_marker' => 'keep']]);

        $this->signIn('owner');
        $this->patchJson('/api/v1/admin/inventory/'.$item->id, $this->editPayload($fx, ['device_model_variant_id' => $variant->id]))->assertOk();

        $fresh = $item->fresh();
        $this->assertSame($fx['model'], $fresh->device_model_id);
        $this->assertSame($variant->id, $fresh->device_model_variant_id);
        $this->assertSame('keep', $fresh->metadata['origin_marker']);
    }

    public function test_crud_without_variant_associates_model_only_and_never_invents_one(): void
    {
        $fx = $this->fixtures();
        $this->variant($fx['model']);
        $item = $this->device();

        $this->signIn('owner');
        $this->patchJson('/api/v1/admin/inventory/'.$item->id, $this->editPayload($fx))->assertOk();

        $this->assertSame($fx['model'], $item->fresh()->device_model_id);
        $this->assertNull($item->fresh()->device_model_variant_id);
    }

    public function test_crud_keeps_variant_when_omitted_and_clears_it_when_model_changes(): void
    {
        $fx = $this->fixtures();
        $variant = $this->variant($fx['model']);
        $item = $this->device(['device_model_id' => $fx['model'], 'device_model_variant_id' => $variant->id]);

        $this->signIn('owner');
        $this->patchJson('/api/v1/admin/inventory/'.$item->id, $this->editPayload($fx, ['description' => 'solo nota']))->assertOk();
        $this->assertSame($variant->id, $item->fresh()->device_model_variant_id);

        $this->patchJson('/api/v1/admin/inventory/'.$item->id, $this->editPayload($fx, ['device_model_id' => $fx['otherModel']]))->assertOk();
        $this->assertSame($fx['otherModel'], $item->fresh()->device_model_id);
        $this->assertNull($item->fresh()->device_model_variant_id);
    }

    public function test_crud_explicit_null_clears_the_variant(): void
    {
        $fx = $this->fixtures();
        $variant = $this->variant($fx['model']);
        $item = $this->device(['device_model_id' => $fx['model'], 'device_model_variant_id' => $variant->id]);

        $this->signIn('owner');
        $this->patchJson('/api/v1/admin/inventory/'.$item->id, $this->editPayload($fx, ['device_model_variant_id' => null]))->assertOk();
        $this->assertNull($item->fresh()->device_model_variant_id);
    }

    public function test_crud_rejects_variant_of_another_model_and_leaves_unit_untouched(): void
    {
        $fx = $this->fixtures();
        $foreign = $this->variant($fx['otherModel'], 'foreign');
        $item = $this->device(['metadata' => ['origin_marker' => 'keep']]);

        $this->signIn('owner');
        $this->patchJson('/api/v1/admin/inventory/'.$item->id, $this->editPayload($fx, ['device_model_variant_id' => $foreign->id]))
            ->assertStatus(422)->assertJsonValidationErrors('device_model_variant_id');

        $fresh = $item->fresh();
        $this->assertNull($fresh->device_model_id);
        $this->assertNull($fresh->device_model_variant_id);
        $this->assertSame('keep', $fresh->metadata['origin_marker']);
    }

    public function test_crud_rejects_new_assignment_of_inactive_variant_but_keeps_an_existing_one(): void
    {
        $fx = $this->fixtures();
        $variant = $this->variant($fx['model'], 'will-retire');
        $retiredOther = $this->variant($fx['model'], 'already-retired', ['active' => false]);
        $item = $this->device(['device_model_id' => $fx['model'], 'device_model_variant_id' => $variant->id]);
        $variant->update(['active' => false]);

        $this->signIn('owner');
        $this->patchJson('/api/v1/admin/inventory/'.$item->id, $this->editPayload($fx, ['device_model_variant_id' => $variant->id]))->assertOk();
        $this->patchJson('/api/v1/admin/inventory/'.$item->id, $this->editPayload($fx, ['device_model_variant_id' => $retiredOther->id]))
            ->assertStatus(422)->assertJsonValidationErrors('device_model_variant_id');
        $this->assertSame($variant->id, $item->fresh()->device_model_variant_id);
    }

    public function test_crud_rejects_model_from_another_brand(): void
    {
        $fx = $this->fixtures();
        $item = $this->device();

        $this->signIn('owner');
        $this->patchJson('/api/v1/admin/inventory/'.$item->id, $this->editPayload($fx, ['brand_id' => 'brand-samsung']))
            ->assertStatus(422);
        $this->assertNull($item->fresh()->device_model_id);
    }

    public function test_quick_intake_persists_explicit_model_and_variant(): void
    {
        $fx = $this->fixtures();
        $variant = $this->variant($fx['model']);

        $this->signIn('intake_operator');
        $id = $this->postJson('/api/v1/admin/inventory', $this->intakePayload([
            'device_model_id' => $fx['model'], 'device_model_variant_id' => $variant->id,
        ]))->assertCreated()->json('id');

        $this->assertDatabaseHas('inventory_items', ['id' => $id, 'device_model_id' => $fx['model'], 'device_model_variant_id' => $variant->id]);
    }

    public function test_quick_intake_rejects_inconsistent_references_without_creating_rows(): void
    {
        $fx = $this->fixtures();
        $foreign = $this->variant($fx['otherModel'], 'foreign');
        $inactive = $this->variant($fx['model'], 'inactive', ['active' => false]);
        $this->signIn('intake_operator');

        $cases = [
            'foreign variant' => ['device_model_id' => $fx['model'], 'device_model_variant_id' => $foreign->id],
            'variant without model' => ['device_model_variant_id' => $foreign->id],
            'inactive variant' => ['device_model_id' => $fx['model'], 'device_model_variant_id' => $inactive->id],
            'brand as model' => ['device_model_id' => $fx['brand']],
            'unknown model' => ['device_model_id' => 'does-not-exist'],
            'model of another brand' => ['device_model_id' => $fx['model'], 'metadata' => ['brand_id' => 'brand-samsung']],
        ];
        foreach ($cases as $name => $extra) {
            $this->postJson('/api/v1/admin/inventory', $this->intakePayload($extra))->assertStatus(422, $name);
        }
        $this->assertDatabaseCount('inventory_items', 0);
    }

    public function test_quick_intake_rejects_model_reference_on_non_device_items(): void
    {
        $fx = $this->fixtures();
        $this->signIn('intake_operator');
        $this->postJson('/api/v1/admin/inventory', $this->intakePayload(['item_type' => 'spare_part', 'device_model_id' => $fx['model']]))
            ->assertStatus(422)->assertJsonValidationErrors('device_model_id');
        $this->assertDatabaseCount('inventory_items', 0);
    }

    public function test_quick_intake_stays_compatible_with_legacy_clients(): void
    {
        $fx = $this->fixtures();
        $this->signIn('intake_operator');

        // 1) No catalog data at all (oldest clients): still created, FKs empty.
        $plain = $this->postJson('/api/v1/admin/inventory', $this->intakePayload())->assertCreated()->json('id');
        $this->assertDatabaseHas('inventory_items', ['id' => $plain, 'device_model_id' => null, 'device_model_variant_id' => null]);

        // 2) Model only in metadata and valid: promoted to the FK, variant NOT invented.
        $promoted = $this->postJson('/api/v1/admin/inventory', $this->intakePayload([
            'metadata' => ['device_model_id' => $fx['model'], 'brand_id' => $fx['brand']],
        ]))->assertCreated()->json('id');
        $this->assertDatabaseHas('inventory_items', ['id' => $promoted, 'device_model_id' => $fx['model'], 'device_model_variant_id' => null]);

        // 3) Metadata model that contradicts its brand: created, but never promoted (no guessing).
        $notPromoted = $this->postJson('/api/v1/admin/inventory', $this->intakePayload([
            'metadata' => ['device_model_id' => $fx['model'], 'brand_id' => 'brand-samsung'],
        ]))->assertCreated()->json('id');
        $this->assertDatabaseHas('inventory_items', ['id' => $notPromoted, 'device_model_id' => null]);

        // 4) Garbage metadata id: created, FK empty.
        $garbage = $this->postJson('/api/v1/admin/inventory', $this->intakePayload(['metadata' => ['device_model_id' => 'OLDID']]))->assertCreated()->json('id');
        $this->assertDatabaseHas('inventory_items', ['id' => $garbage, 'device_model_id' => null]);
    }

    public function test_free_text_brand_model_edit_is_blocked_only_for_catalog_linked_devices(): void
    {
        $fx = $this->fixtures();
        $linked = $this->device(['device_model_id' => $fx['model']]);
        $legacy = $this->device(['sku' => 'FXP-LEGACY']);

        $this->signIn('owner');
        $this->patchJson('/api/v1/admin/inventory/items/'.$linked->id, ['model' => 'Texto libre'])
            ->assertStatus(422)->assertJsonValidationErrors('model');
        $this->assertSame('iPhone 13', $linked->fresh()->model);

        $this->patchJson('/api/v1/admin/inventory/items/'.$legacy->id, ['model' => 'Texto libre'])->assertOk();
        $this->assertSame('Texto libre', $legacy->fresh()->model);
    }

    public function test_eloquent_last_line_of_defence_rejects_inconsistent_assignment(): void
    {
        $fx = $this->fixtures();
        $foreign = $this->variant($fx['otherModel'], 'foreign');
        $item = $this->device(['device_model_id' => $fx['model']]);

        $this->expectException(ValidationException::class);
        $item->update(['device_model_variant_id' => $foreign->id]);
    }

    // ───────────── Variant media: references and deletion policy ─────────────

    private function media(string $modelId, ?string $variantId = null, string $key = 'img.webp'): DeviceModelMedia
    {
        return DeviceModelMedia::query()->create([
            'device_model_id' => $modelId, 'device_model_variant_id' => $variantId,
            'storage_disk' => 'r2', 'object_key' => $key, 'media_type' => 'image/webp',
        ]);
    }

    public function test_variant_media_requires_variant_of_the_same_model(): void
    {
        $fx = $this->fixtures();
        $own = $this->variant($fx['model'], 'own');
        $foreign = $this->variant($fx['otherModel'], 'foreign');

        $this->media($fx['model'], null, 'model.webp');
        $this->media($fx['model'], $own->id, 'variant.webp');
        $this->assertDatabaseCount('device_model_media', 2);

        try {
            $this->media($fx['model'], $foreign->id, 'bad.webp');
            $this->fail('Se aceptó una imagen de variante de otro modelo.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('device_model_variant_id', $e->errors());
        }
        $this->assertDatabaseCount('device_model_media', 2);
    }

    public function test_media_rows_cannot_be_deleted_silently(): void
    {
        $fx = $this->fixtures();
        $media = $this->media($fx['model']);

        try {
            $media->delete();
            $this->fail('Se eliminó una fila de media sin proceso seguro.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('media', $e->errors());
        }
        $this->assertDatabaseHas('device_model_media', ['id' => $media->id, 'object_key' => 'img.webp']);
    }

    public function test_variant_with_images_or_units_cannot_be_deleted_or_reparented(): void
    {
        $fx = $this->fixtures();
        $withMedia = $this->variant($fx['model'], 'with-media');
        $withUnit = $this->variant($fx['model'], 'with-unit');
        $free = $this->variant($fx['model'], 'free');
        $this->media($fx['model'], $withMedia->id);
        $this->device(['device_model_id' => $fx['model'], 'device_model_variant_id' => $withUnit->id]);

        foreach ([$withMedia, $withUnit] as $referenced) {
            try {
                $referenced->delete();
                $this->fail('Se eliminó una variante referenciada.');
            } catch (ValidationException $e) {
                $this->assertArrayHasKey('variant', $e->errors());
            }
            try {
                $referenced->update(['device_model_id' => $fx['otherModel']]);
                $this->fail('Se movió una variante referenciada a otro modelo.');
            } catch (ValidationException $e) {
                $this->assertArrayHasKey('variant', $e->errors());
            }
        }
        $this->assertDatabaseHas('device_model_variants', ['id' => $withMedia->id, 'device_model_id' => $fx['model']]);
        $this->assertDatabaseHas('device_model_variants', ['id' => $withUnit->id, 'device_model_id' => $fx['model']]);

        $free->delete();
        $this->assertDatabaseMissing('device_model_variants', ['id' => $free->id]);
    }

    public function test_database_foreign_key_rejects_mismatched_variant_media_and_blocks_variant_delete(): void
    {
        $fx = $this->fixtures();
        $variant = $this->variant($fx['model'], 'fk');
        $media = $this->media($fx['model'], $variant->id);

        try {
            DB::table('device_model_media')->where('id', $media->id)->update(['device_model_id' => $fx['otherModel']]);
            $this->fail('La FK compuesta aceptó un par modelo-variante incoherente.');
        } catch (QueryException) {
            $this->assertSame($fx['model'], DB::table('device_model_media')->where('id', $media->id)->value('device_model_id'));
        }

        try {
            DB::table('device_model_variants')->where('id', $variant->id)->delete();
            $this->fail('La FK RESTRICT permitió borrar una variante con imágenes.');
        } catch (QueryException) {
            $this->assertDatabaseHas('device_model_variants', ['id' => $variant->id]);
        }
    }

    // ───────────── Rollback: real risks, tested ─────────────

    public function test_rollback_is_refused_while_variant_images_exist_and_nothing_is_lost(): void
    {
        $fx = $this->fixtures();
        $variant = $this->variant($fx['model'], 'keep-me');
        $this->media($fx['model'], $variant->id, 'variant.webp');

        $migration = require base_path(self::MIGRATION);
        try {
            $migration->down();
            $this->fail('El rollback se ejecutó pese a existir imágenes de variantes.');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('Rollback bloqueado', $e->getMessage());
        }

        $this->assertTrue(Schema::hasColumn('device_model_media', 'device_model_variant_id'));
        $this->assertDatabaseHas('device_model_media', ['object_key' => 'variant.webp', 'device_model_variant_id' => $variant->id]);
    }

    public function test_rollback_succeeds_without_variant_images_preserves_model_images_and_can_be_reapplied(): void
    {
        $fx = $this->fixtures();
        $this->media($fx['model'], null, 'model-wide.webp');
        $migration = require base_path(self::MIGRATION);

        $migration->down();
        $this->assertFalse(Schema::hasColumn('device_model_media', 'device_model_variant_id'));
        $this->assertDatabaseHas('device_model_media', ['object_key' => 'model-wide.webp']);

        $migration->up();
        $this->assertTrue(Schema::hasColumn('device_model_media', 'device_model_variant_id'));
        $this->assertDatabaseHas('device_model_media', ['object_key' => 'model-wide.webp', 'device_model_variant_id' => null]);
    }

    public function test_migration_leaves_historical_rows_valid(): void
    {
        $fx = $this->fixtures();
        // Historical row written the "old way" (no variant column value).
        DB::table('device_model_media')->insert([
            'id' => (string) Str::ulid(), 'device_model_id' => $fx['model'], 'storage_disk' => 'r2',
            'object_key' => 'historic.webp', 'media_type' => 'image/webp', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->assertDatabaseHas('device_model_media', ['object_key' => 'historic.webp', 'device_model_variant_id' => null]);
    }
}
