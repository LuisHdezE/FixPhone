<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class MasterDataEndpointsTest extends TestCase
{
    use RefreshDatabase;

    public function test_seed_catalog_is_loaded_from_versioned_json(): void
    {
        $this->getJson('/api/v1/admin/master-data')
            ->assertOk()
            ->assertJsonCount(5, 'data.brands')
            ->assertJsonCount(11, 'data.deviceModels')
            ->assertJsonCount(10, 'data.categories')
            ->assertJsonCount(6, 'data.colors')
            ->assertJsonCount(5, 'data.storageCapacities')
            ->assertJsonCount(6, 'data.ramCapacities')
            ->assertJsonCount(5, 'data.conditions')
            ->assertJsonCount(8, 'data.sparePartTypes')
            ->assertJsonPath('data.brands.0.id', 'brand-apple')
            ->assertJsonPath('data.deviceModels.0.brandId', 'brand-apple');
    }

    public function test_master_data_kind_supports_create_update_and_delete(): void
    {
        $created = $this->postJson('/api/v1/admin/master-data/colors', [
            'name' => 'Verde',
            'slug' => 'verde',
            'hex' => '#16A34A',
            'active' => true,
            'sortOrder' => 70,
        ])->assertCreated()
            ->assertJsonPath('name', 'Verde')
            ->assertJsonPath('hex', '#16A34A');

        $id = $created->json('id');
        $this->assertIsString($id);

        $this->patchJson('/api/v1/admin/master-data/colors/'.$id, [
            'hex' => '#15803D',
            'active' => false,
        ])->assertOk()
            ->assertJsonPath('id', $id)
            ->assertJsonPath('hex', '#15803D')
            ->assertJsonPath('active', false);

        $this->getJson('/api/v1/admin/master-data/colors')
            ->assertOk()
            ->assertJsonFragment(['id' => $id, 'name' => 'Verde']);

        $this->deleteJson('/api/v1/admin/master-data/colors/'.$id)
            ->assertOk()
            ->assertJsonPath('deleted', true)
            ->assertJsonPath('id', $id);

        $this->getJson('/api/v1/admin/master-data/colors')
            ->assertOk()
            ->assertJsonMissing(['id' => $id]);
    }

    public function test_unknown_master_data_kind_is_rejected(): void
    {
        $this->getJson('/api/v1/admin/master-data/not-a-kind')->assertNotFound();
    }
}
