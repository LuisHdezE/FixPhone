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

    public function test_brand_with_device_models_cannot_be_deleted(): void
    {
        $this->deleteJson('/api/v1/admin/master-data/brands/brand-huawei')
            ->assertStatus(409);

        $this->getJson('/api/v1/admin/master-data/brands')
            ->assertJsonFragment(['id' => 'brand-huawei']);

        $this->deleteJson('/api/v1/admin/master-data/deviceModels/model-p30-lite')->assertOk();
        $this->deleteJson('/api/v1/admin/master-data/brands/brand-huawei')->assertOk();
    }

    public function test_parent_category_with_children_cannot_be_deleted(): void
    {
        $this->deleteJson('/api/v1/admin/master-data/categories/cat-accessories')
            ->assertStatus(409);

        $this->deleteJson('/api/v1/admin/master-data/categories/cat-accessories-chargers')->assertOk();
        $this->deleteJson('/api/v1/admin/master-data/categories/cat-accessories')->assertOk();
    }

    public function test_parent_spare_part_type_with_children_cannot_be_deleted(): void
    {
        $this->deleteJson('/api/v1/admin/master-data/sparePartTypes/part-display')
            ->assertStatus(409);

        $this->deleteJson('/api/v1/admin/master-data/sparePartTypes/part-battery')->assertOk();
    }

    public function test_device_model_requires_existing_brand(): void
    {
        $this->postJson('/api/v1/admin/master-data/deviceModels', ['name' => 'Sin marca'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('brandId');

        $this->postJson('/api/v1/admin/master-data/deviceModels', [
            'name' => 'Marca fantasma',
            'brandId' => 'brand-missing',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('brandId');

        $this->patchJson('/api/v1/admin/master-data/deviceModels/model-iphone-11', [
            'brandId' => 'brand-missing',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('brandId');

        $this->patchJson('/api/v1/admin/master-data/deviceModels/model-iphone-11', [
            'brandId' => null,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('brandId');

        $this->postJson('/api/v1/admin/master-data/deviceModels', [
            'name' => 'Galaxy S24',
            'brandId' => 'brand-samsung',
        ])->assertCreated()
            ->assertJsonPath('brandId', 'brand-samsung');
    }

    public function test_hierarchical_parent_must_exist_and_cannot_be_self(): void
    {
        foreach (['categories' => 'cat-phones', 'sparePartTypes' => 'part-camera'] as $kind => $existingId) {
            $this->postJson('/api/v1/admin/master-data/'.$kind, [
                'name' => 'Huérfano',
                'parentId' => 'missing-parent',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors('parentId');

            $this->patchJson('/api/v1/admin/master-data/'.$kind.'/'.$existingId, [
                'parentId' => $existingId,
            ])->assertUnprocessable()
                ->assertJsonValidationErrors('parentId');

            $this->patchJson('/api/v1/admin/master-data/'.$kind.'/'.$existingId, [
                'parentId' => 'missing-parent',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors('parentId');

            $this->postJson('/api/v1/admin/master-data/'.$kind, [
                'name' => 'Raíz',
                'parentId' => null,
            ])->assertCreated();

            $this->postJson('/api/v1/admin/master-data/'.$kind, [
                'name' => 'Hijo válido',
                'parentId' => $existingId,
            ])->assertCreated()
                ->assertJsonPath('parentId', $existingId);
        }
    }
}
