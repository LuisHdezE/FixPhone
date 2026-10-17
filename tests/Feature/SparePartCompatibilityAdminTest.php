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

final class SparePartCompatibilityAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_link_model_without_changing_stock_and_cannot_remove_original_model(): void
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => 'Owner',
            'email' => 'model-link@fixphone.test',
            'password' => Hash::make('test-password'),
            'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => 'owner']);
        Sanctum::actingAs($user);

        foreach (['model-a22-5g', 'model-other'] as $modelId) {
            MasterDataEntry::query()->create([
                'id' => $modelId, 'kind' => 'deviceModels',
                'payload' => ['id' => $modelId, 'name' => $modelId, 'active' => true, 'brandId' => 'brand-samsung'],
            ]);
        }
        $part = InventoryItem::query()->create([
            'sku' => 'REP-MODEL-ADMIN', 'title' => 'Motor de vibración A22 5G',
            'item_type' => 'spare_part', 'brand' => 'Samsung', 'model' => 'Galaxy A22 5G',
            'inventory_purpose' => 'sell_as_spare_part', 'operational_status' => 'en_stock',
            'publication_status' => 'no_publicable', 'currency_code' => 'UYU',
            'stock_quantity' => 3, 'metadata' => ['device_model_id' => 'model-a22-5g'],
        ]);
        $part->forceFill(['component_identity_key' => hash('sha256', 'example')])->save();

        $url = "/api/v1/admin/inventory/spare-parts/{$part->id}/compatibilities";
        $this->putJson($url, [
            'device_model_ids' => ['model-other'],
            'reason' => 'Comprobación técnica documentada',
        ])->assertUnprocessable();
        $this->assertSame(3, $part->fresh()->stock_quantity);
        $this->putJson($url, [
            'device_model_ids' => ['model-a22-5g', 'model-other'],
            'reason' => 'Comprobación técnica documentada',
        ])->assertOk()->assertJsonCount(2, 'data.device_model_ids');
        $this->assertSame(3, $part->fresh()->stock_quantity);
        $this->assertDatabaseHas('audit_events', [
            'entity_id' => $part->id,
            'event_type' => 'inventory.part_compatibility_updated',
        ]);
    }
}
