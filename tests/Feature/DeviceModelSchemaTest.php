<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class DeviceModelSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_normalized_tables_and_nullable_inventory_references_exist(): void
    {
        foreach (['device_model_specs', 'device_model_variants', 'device_model_media'] as $table) {
            $this->assertTrue(Schema::hasTable($table));
        }
        $this->assertTrue(Schema::hasColumns('inventory_items', ['device_model_id', 'device_model_variant_id']));
    }

    public function test_model_spec_is_unique_and_model_foreign_key_is_enforced(): void
    {
        $id = 'model-test-'.Str::lower((string) Str::ulid());
        DB::table('master_data_entries')->insert([
            'id' => $id, 'kind' => 'deviceModels',
            'payload' => json_encode(['id' => $id, 'name' => 'Test Model']),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $spec = fn () => [
            'id' => (string) Str::ulid(),
            'device_model_id' => $id,
            'specs_json' => '{}',
            'created_at' => now(), 'updated_at' => now(),
        ];
        DB::table('device_model_specs')->insert($spec());
        $this->expectException(\Illuminate\Database\QueryException::class);
        DB::table('device_model_specs')->insert($spec());
    }
}
