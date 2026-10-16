<?php

namespace Tests\Feature;

use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\MasterData\DeviceModelMedia;
use App\Infrastructure\MasterData\DeviceModelSpec;
use App\Infrastructure\MasterData\DeviceModelVariant;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

final class DeviceModelEloquentIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private function catalogEntry(string $kind): string
    {
        $id = 'test-'.Str::lower((string) Str::ulid());
        DB::table('master_data_entries')->insert([
            'id' => $id,
            'kind' => $kind,
            'payload' => json_encode(['id' => $id, 'name' => 'Test']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $id;
    }

    private function device(array $attributes = []): InventoryItem
    {
        return InventoryItem::query()->create(array_replace([
            'sku' => 'FXP-'.(string) Str::ulid(),
            'title' => 'Dispositivo de prueba',
            'item_type' => 'used_phone',
            'brand' => 'Prueba',
            'model' => 'Prueba',
            'operational_status' => 'ingresado',
            'publication_status' => 'no_publicable',
            'inventory_purpose' => 'internal_use',
            'is_sellable' => false,
            'stock_quantity' => 1,
        ], $attributes));
    }

    public function test_eloquent_rejects_non_model_spec_and_media(): void
    {
        $brandId = $this->catalogEntry('brands');

        foreach ([
            fn () => DeviceModelSpec::query()->create(['device_model_id' => $brandId, 'specs_json' => []]),
            fn () => DeviceModelMedia::query()->create([
                'device_model_id' => $brandId,
                'storage_disk' => 'r2',
                'object_key' => 'test.jpg',
                'media_type' => 'image/jpeg',
            ]),
        ] as $save) {
            try {
                $save();
                $this->fail('Se permitió una referencia a marca como modelo.');
            } catch (ValidationException $e) {
                $this->assertArrayHasKey('device_model_id', $e->errors());
            }
        }

        $this->assertDatabaseCount('device_model_specs', 0);
        $this->assertDatabaseCount('device_model_media', 0);
    }

    public function test_eloquent_rejects_ram_from_storage_catalog(): void
    {
        $modelId = $this->catalogEntry('deviceModels');
        $wrongRamId = $this->catalogEntry('storageCapacities');

        try {
            DeviceModelVariant::query()->create([
                'device_model_id' => $modelId,
                'variant_key' => 'bad',
                'name' => 'Incorrecta',
                'ram_capacity_id' => $wrongRamId,
            ]);
            $this->fail('Se permitió almacenamiento como memoria RAM.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('ram_capacity_id', $e->errors());
        }

        $this->assertDatabaseCount('device_model_variants', 0);
    }

    public function test_inventory_rejects_foreign_variant_and_variant_without_model(): void
    {
        $modelA = $this->catalogEntry('deviceModels');
        $modelB = $this->catalogEntry('deviceModels');
        $variant = DeviceModelVariant::query()->create([
            'device_model_id' => $modelA,
            'variant_key' => 'test',
            'name' => 'Variante',
        ]);

        foreach ([
            ['device_model_id' => $modelB, 'device_model_variant_id' => $variant->id],
            ['device_model_variant_id' => $variant->id],
        ] as $invalid) {
            try {
                $this->device($invalid);
                $this->fail('Se permitió asignar una variante sin su modelo correcto.');
            } catch (ValidationException $e) {
                $this->assertNotEmpty($e->errors());
            }
        }
    }

    public function test_spare_parts_reject_commercial_model_reference(): void
    {
        $model = $this->catalogEntry('deviceModels');

        $this->expectException(ValidationException::class);
        $this->device(['item_type' => 'spare_part', 'device_model_id' => $model]);
    }

    public function test_correct_model_variant_and_specs_are_persisted_without_copying_specs(): void
    {
        $model = $this->catalogEntry('deviceModels');
        $ram = $this->catalogEntry('ramCapacities');
        $storage = $this->catalogEntry('storageCapacities');

        DeviceModelSpec::query()->create([
            'device_model_id' => $model,
            'specs_json' => ['wifi' => '802.11ax'],
        ]);
        $variant = DeviceModelVariant::query()->create([
            'device_model_id' => $model,
            'variant_key' => '8gb-128gb',
            'name' => '8 / 128',
            'ram_capacity_id' => $ram,
            'storage_capacity_id' => $storage,
        ]);
        $item = $this->device([
            'device_model_id' => $model,
            'device_model_variant_id' => $variant->id,
            'metadata' => ['physical_condition' => 'Good'],
        ]);

        $this->assertDatabaseHas('inventory_items', [
            'id' => $item->id,
            'device_model_id' => $model,
            'device_model_variant_id' => $variant->id,
        ]);
        $this->assertSame(['physical_condition' => 'Good'], $item->fresh()->metadata);
    }

    public function test_composite_foreign_key_rejects_mismatched_direct_sql_write(): void
    {
        $modelA = $this->catalogEntry('deviceModels');
        $modelB = $this->catalogEntry('deviceModels');
        $variant = DeviceModelVariant::query()->create([
            'device_model_id' => $modelA,
            'variant_key' => 'test',
            'name' => 'Variante',
        ]);
        $item = $this->device(['device_model_id' => $modelA, 'device_model_variant_id' => $variant->id]);

        $this->expectException(QueryException::class);
        DB::table('inventory_items')->where('id', $item->id)->update(['device_model_id' => $modelB]);
    }
}
