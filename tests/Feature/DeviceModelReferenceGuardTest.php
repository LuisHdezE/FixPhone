<?php

namespace Tests\Feature;

use App\Infrastructure\MasterData\DeviceModelReferenceGuard;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class DeviceModelReferenceGuardTest extends TestCase
{
    use RefreshDatabase;

    private function entry(string $kind): string
    {
        $id = 'test-'.Str::lower((string) Str::ulid());
        DB::table('master_data_entries')->insert([
            'id' => $id, 'kind' => $kind,
            'payload' => json_encode(['id' => $id, 'name' => 'Test']),
            'created_at' => now(), 'updated_at' => now(),
        ]);
        return $id;
    }

    public function test_rejects_brand_as_model(): void
    {
        $this->expectException(ValidationException::class);
        app(DeviceModelReferenceGuard::class)->assertKind($this->entry('brands'), 'deviceModels', 'device_model_id');
    }

    public function test_rejects_storage_as_ram(): void
    {
        $this->expectException(ValidationException::class);
        app(DeviceModelReferenceGuard::class)->assertCapacities($this->entry('storageCapacities'), null);
    }

    public function test_rejects_variant_of_a_different_model(): void
    {
        $modelA = $this->entry('deviceModels');
        $modelB = $this->entry('deviceModels');
        $variant = (string) Str::ulid();
        DB::table('device_model_variants')->insert([
            'id' => $variant, 'device_model_id' => $modelA,
            'variant_key' => 'test', 'name' => 'Test',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->expectException(ValidationException::class);
        app(DeviceModelReferenceGuard::class)->assertVariantBelongsToModel($variant, $modelB);
    }

    public function test_accepts_variant_of_its_model(): void
    {
        $model = $this->entry('deviceModels');
        $variant = (string) Str::ulid();
        DB::table('device_model_variants')->insert([
            'id' => $variant, 'device_model_id' => $model,
            'variant_key' => 'test', 'name' => 'Test',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        app(DeviceModelReferenceGuard::class)->assertKind($model, 'deviceModels', 'device_model_id');
        app(DeviceModelReferenceGuard::class)->assertVariantBelongsToModel($variant, $model);
        $this->assertTrue(true);
    }
}
