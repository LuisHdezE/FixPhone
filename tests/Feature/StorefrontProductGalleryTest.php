<?php

namespace Tests\Feature;

use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\Media\InventoryItemPhoto;
use App\Infrastructure\Media\InventoryItemPromotionalAsset;
use App\Infrastructure\Media\MediaStorageProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

final class StorefrontProductGalleryTest extends TestCase
{
    use RefreshDatabase;

    private function createStorageProfile(): MediaStorageProfile
    {
        return MediaStorageProfile::query()->create([
            'name' => 'R2',
            'provider' => 'r2',
            'bucket' => 'images',
            'endpoint_url' => 'https://test.r2.cloudflarestorage.com',
            'public_base_url' => 'https://cdn.fixphone.test',
            'object_prefix' => 'media',
            'access_key_id_encrypted' => Crypt::encryptString('access'),
            'secret_access_key_encrypted' => Crypt::encryptString('secret'),
            'is_selected' => true,
        ]);
    }

    private function createDevice(array $attributes = []): InventoryItem
    {
        return InventoryItem::query()->create(array_merge([
            'sku' => 'FXP-' . Str::upper(Str::random(8)),
            'title' => 'Samsung Galaxy A22 5G',
            'item_type' => 'used_phone',
            'brand' => 'Samsung',
            'model' => 'Galaxy A22 5G',
            'operational_status' => 'disponible',
            'publication_status' => 'publicado',
            'inventory_purpose' => 'sell_as_used_phone',
            'is_sellable' => true,
            'stock_quantity' => 1,
            'sale_price_amount_minor' => 1250000,
            'currency_code' => 'UYU',
            'metadata' => [],
        ], $attributes));
    }

    private function createPhoto(string $deviceId, array $attributes = []): InventoryItemPhoto
    {
        $profile = MediaStorageProfile::query()->first() ?? $this->createStorageProfile();

        return InventoryItemPhoto::query()->create(array_merge([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $deviceId,
            'media_storage_profile_id' => $profile->id,
            'object_key' => 'media/photos/' . Str::random(12) . '.webp',
            'public_url' => 'https://cdn.fixphone.test/real-photo-' . Str::random(6) . '.webp',
            'content_type' => 'image/webp',
            'byte_size' => 2048,
            'status' => 'confirmed',
            'sort_order' => 0,
            'is_primary' => false,
            'upload_expires_at' => now()->addHour(),
        ], $attributes));
    }

    private function createPromotionalAsset(string $deviceId, string $photoId, array $attributes = []): InventoryItemPromotionalAsset
    {
        return InventoryItemPromotionalAsset::query()->create(array_merge([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $deviceId,
            'source_photo_id' => $photoId,
            'prompt_code' => 'PROMPT-0001',
            'prompt_version' => '1.0',
            'prompt_snapshot' => 'Snapshot test',
            'status' => 'approved',
            'image_url' => 'https://cdn.fixphone.test/ad-' . Str::random(6) . '.webp',
            'created_at' => now(),
        ], $attributes));
    }

    public function test_only_approved_promotional_assets_are_exposed_in_storefront(): void
    {
        $device = $this->createDevice();
        $photo = $this->createPhoto($device->id, ['is_primary' => true]);

        $approved = $this->createPromotionalAsset($device->id, $photo->id, [
            'status' => 'approved',
            'image_url' => 'https://cdn.fixphone.test/approved-ad.webp',
        ]);

        $response = $this->getJson('/api/v1/store/products')->assertOk();
        $item = collect($response->json())->firstWhere('id', $device->id);

        $this->assertNotNull($item);
        $this->assertCount(1, $item['promotional_assets']);
        $this->assertSame($approved->id, $item['promotional_assets'][0]['id']);
        $this->assertSame('https://cdn.fixphone.test/approved-ad.webp', $item['promotional_assets'][0]['url']);
        $this->assertSame('advertisement', $item['promotional_assets'][0]['type']);
        $this->assertSame('PROMPT-0001', $item['promotional_assets'][0]['prompt_code']);
    }

    public function test_devices_marked_for_parts_are_not_published_as_used_phones(): void
    {
        $donor = $this->createDevice([
            'sku' => 'FXP-PARTS-001',
            'inventory_purpose' => 'sell_as_spare_part',
            'metadata' => ['destination' => 'Donor'],
        ]);
        $part = InventoryItem::query()->create([
            'sku' => 'PART-001', 'title' => 'Pantalla Samsung', 'item_type' => 'spare_part',
            'operational_status' => 'en_stock', 'publication_status' => 'publicado',
            'inventory_purpose' => 'sell_as_spare_part', 'is_sellable' => true,
            'stock_quantity' => 1, 'sale_price_amount_minor' => 10000,
            'currency_code' => 'UYU', 'metadata' => [],
        ]);

        $response = $this->getJson('/api/v1/store/products')->assertOk();
        $ids = collect($response->json())->pluck('id');

        $this->assertFalse($ids->contains($donor->id));
        $this->assertTrue($ids->contains($part->id));
    }

    public function test_prepared_uploaded_and_discarded_assets_are_never_exposed(): void
    {
        $device = $this->createDevice();
        $photo = $this->createPhoto($device->id, ['is_primary' => true]);

        // Prepared asset (no image)
        $this->createPromotionalAsset($device->id, $photo->id, [
            'status' => 'prepared',
            'image_url' => null,
        ]);

        // Uploaded asset (image uploaded but not approved)
        $this->createPromotionalAsset($device->id, $photo->id, [
            'status' => 'uploaded',
            'image_url' => 'https://cdn.fixphone.test/unapproved-uploaded.webp',
        ]);

        // Discarded asset
        $this->createPromotionalAsset($device->id, $photo->id, [
            'status' => 'discarded',
            'image_url' => 'https://cdn.fixphone.test/discarded.webp',
        ]);

        $response = $this->getJson('/api/v1/store/products')->assertOk();
        $item = collect($response->json())->firstWhere('id', $device->id);

        $this->assertNotNull($item);
        $this->assertEmpty($item['promotional_assets']);
        $this->assertCount(1, $item['gallery']);
        $this->assertSame('real_photo', $item['gallery'][0]['type']);
        $this->assertStringNotContainsString('unapproved-uploaded.webp', json_encode($response->json()));
        $this->assertStringNotContainsString('discarded.webp', json_encode($response->json()));
    }

    public function test_real_photos_maintain_strict_priority_over_promotional_assets_in_gallery(): void
    {
        $device = $this->createDevice();
        $photo1 = $this->createPhoto($device->id, [
            'public_url' => 'https://cdn.fixphone.test/real-1.webp',
            'is_primary' => true,
            'sort_order' => 0,
        ]);
        $photo2 = $this->createPhoto($device->id, [
            'public_url' => 'https://cdn.fixphone.test/real-2.webp',
            'is_primary' => false,
            'sort_order' => 1,
        ]);

        $ad = $this->createPromotionalAsset($device->id, $photo1->id, [
            'public_url' => null,
            'image_url' => 'https://cdn.fixphone.test/approved-ad.webp',
            'status' => 'approved',
        ]);

        $response = $this->getJson('/api/v1/store/products')->assertOk();
        $item = collect($response->json())->firstWhere('id', $device->id);

        $this->assertNotNull($item);
        // Gallery must have real photos first, then approved promotional asset
        $this->assertCount(3, $item['gallery']);
        $this->assertSame('real_photo', $item['gallery'][0]['type']);
        $this->assertSame($photo1->id, $item['gallery'][0]['id']);
        $this->assertSame('https://cdn.fixphone.test/real-1.webp', $item['gallery'][0]['url']);

        $this->assertSame('real_photo', $item['gallery'][1]['type']);
        $this->assertSame($photo2->id, $item['gallery'][1]['id']);
        $this->assertSame('https://cdn.fixphone.test/real-2.webp', $item['gallery'][1]['url']);

        $this->assertSame('advertisement', $item['gallery'][2]['type']);
        $this->assertSame($ad->id, $item['gallery'][2]['id']);
        $this->assertSame('https://cdn.fixphone.test/approved-ad.webp', $item['gallery'][2]['url']);
    }

    public function test_advertisement_never_becomes_main_image_url_even_when_device_has_no_real_photos(): void
    {
        $modelId = (string) Str::ulid();
        DB::table('master_data_entries')->insert([
            'id' => $modelId,
            'kind' => 'deviceModels',
            'payload' => json_encode(['name' => 'Galaxy A22 5G', 'imageUrl' => 'https://cdn.fixphone.test/model-fallback.webp']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $device = $this->createDevice([
            'brand' => 'Samsung',
            'model' => 'Galaxy A22 5G',
            'device_model_id' => $modelId,
            'main_image_url' => null,
            'metadata' => ['device_model_id' => $modelId],
        ]);

        // Device has a pending/unconfirmed source photo (so 0 confirmed photos exist in showroom)
        $unconfirmedPhoto = $this->createPhoto($device->id, [
            'status' => 'pending',
        ]);
        $this->createPromotionalAsset($device->id, $unconfirmedPhoto->id, [
            'status' => 'approved',
            'image_url' => 'https://cdn.fixphone.test/ad-only.webp',
        ]);

        $response = $this->getJson('/api/v1/store/products')->assertOk();
        $item = collect($response->json())->firstWhere('id', $device->id);

        $this->assertNotNull($item);
        // main_image_url must be the model fallback, NOT the advertisement!
        $this->assertSame('https://cdn.fixphone.test/model-fallback.webp', $item['main_image_url']);
        $this->assertNotSame('https://cdn.fixphone.test/ad-only.webp', $item['main_image_url']);
        $this->assertEmpty($item['photos']);
        $this->assertCount(1, $item['promotional_assets']);
        $this->assertSame('https://cdn.fixphone.test/ad-only.webp', $item['promotional_assets'][0]['url']);
    }

    public function test_multiple_approved_promotional_assets_are_exposed_in_order(): void
    {
        $device = $this->createDevice();
        $photo = $this->createPhoto($device->id, ['is_primary' => true]);

        $ad1 = $this->createPromotionalAsset($device->id, $photo->id, [
            'status' => 'approved',
            'image_url' => 'https://cdn.fixphone.test/ad-first.webp',
            'created_at' => now()->subMinutes(10),
        ]);
        $ad2 = $this->createPromotionalAsset($device->id, $photo->id, [
            'status' => 'approved',
            'image_url' => 'https://cdn.fixphone.test/ad-second.webp',
            'created_at' => now()->subMinutes(5),
        ]);

        $response = $this->getJson('/api/v1/store/products')->assertOk();
        $item = collect($response->json())->firstWhere('id', $device->id);

        $this->assertNotNull($item);
        $this->assertCount(2, $item['promotional_assets']);
        $this->assertSame($ad1->id, $item['promotional_assets'][0]['id']);
        $this->assertSame($ad2->id, $item['promotional_assets'][1]['id']);
        $this->assertSame('https://cdn.fixphone.test/ad-first.webp', $item['promotional_assets'][0]['url']);
        $this->assertSame('https://cdn.fixphone.test/ad-second.webp', $item['promotional_assets'][1]['url']);
    }

    public function test_device_without_promotional_assets_preserves_contract_and_clean_gallery(): void
    {
        $device = $this->createDevice();
        $photo = $this->createPhoto($device->id, [
            'public_url' => 'https://cdn.fixphone.test/only-photo.webp',
            'is_primary' => true,
        ]);

        $response = $this->getJson('/api/v1/store/products')->assertOk();
        $item = collect($response->json())->firstWhere('id', $device->id);

        $this->assertNotNull($item);
        $this->assertSame('https://cdn.fixphone.test/only-photo.webp', $item['main_image_url']);
        $this->assertCount(1, $item['photos']);
        $this->assertEmpty($item['promotional_assets']);
        $this->assertCount(1, $item['gallery']);
        $this->assertSame('real_photo', $item['gallery'][0]['type']);
        $this->assertSame('https://cdn.fixphone.test/only-photo.webp', $item['gallery'][0]['url']);
    }

    public function test_promotional_assets_batch_query_avoids_n_plus_one(): void
    {
        // Create 5 devices with photos and ads
        for ($i = 1; $i <= 5; $i++) {
            $device = $this->createDevice(['sku' => 'FXP-N1-' . $i]);
            $photo = $this->createPhoto($device->id, ['is_primary' => true]);
            $this->createPromotionalAsset($device->id, $photo->id, ['status' => 'approved']);
        }

        DB::flushQueryLog();
        DB::enableQueryLog();

        $this->getJson('/api/v1/store/products')->assertOk();

        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        // Count queries targeting inventory_item_photos and inventory_item_promotional_assets
        $photoQueries = collect($queries)->filter(fn ($q) => str_contains($q['query'], 'inventory_item_photos'));
        $promoQueries = collect($queries)->filter(fn ($q) => str_contains($q['query'], 'inventory_item_promotional_assets'));

        // Both tables MUST be queried exactly 1 time via whereIn batch query, not once per device
        $this->assertCount(1, $photoQueries, 'inventory_item_photos was queried more than once (N+1 query detected)');
        $this->assertCount(1, $promoQueries, 'inventory_item_promotional_assets was queried more than once (N+1 query detected)');
    }
}
