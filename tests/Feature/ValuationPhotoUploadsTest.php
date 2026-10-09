<?php

namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\Media\DeviceValuationPhoto;
use App\Infrastructure\Media\MediaStorageProfile;
use App\Infrastructure\Media\R2Presigner;
use App\Infrastructure\Valuation\DeviceValuation;
use DateTimeImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class ValuationPhotoUploadsTest extends TestCase
{
    use RefreshDatabase;

    private function auth(string $role = 'owner'): void
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => 'FixPhone upload test',
            'email' => $role.'-media-upload@fixphone.test',
            'password' => Hash::make('temporary-testing-password'),
            'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => $role]);
        Sanctum::actingAs($user);
    }

    private function valuation(): DeviceValuation
    {
        return DeviceValuation::query()->create([
            'model_name' => 'iPhone 11',
            'fault_type' => 'icloud',
            'public_listing_status' => 'draft',
        ]);
    }

    private function profile(): MediaStorageProfile
    {
        return MediaStorageProfile::query()->create([
            'name' => 'R2 staging',
            'provider' => 'r2',
            'bucket' => 'fixphone-imagenes',
            'endpoint_url' => 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com',
            'public_base_url' => 'https://pub-example.r2.dev',
            'object_prefix' => 'media',
            'access_key_id_encrypted' => Crypt::encryptString('EXAMPLEACCESSKEY123'),
            'secret_access_key_encrypted' => Crypt::encryptString('EXAMPLESECRETKEY123'),
            'is_selected' => true,
        ]);
    }

    private function grant(string $valuationId, int $bytes = 512): array
    {
        return $this->postJson('/api/v1/admin/valuations/'.$valuationId.'/photos/presign', [
            'content_type' => 'image/webp', 'byte_size' => $bytes,
        ])->assertCreated()->json('data');
    }

    public function test_signer_returns_short_lived_scoped_sigv4_url(): void
    {
        $signer = new R2Presigner();
        $date = new DateTimeImmutable('2026-10-09T12:00:00Z');
        $url = $signer->signedUrl(
            'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com',
            'fixphone-imagenes', 'media/valuations/TEST.webp',
            'access-key', 'private-secret', 'PUT', 180, 'image/webp', $date,
        );
        $this->assertStringStartsWith('https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com/fixphone-imagenes/media/valuations/TEST.webp?', $url);
        $this->assertStringContainsString('X-Amz-Expires=180', $url);
        $this->assertStringContainsString('X-Amz-SignedHeaders=content-type%3Bhost', $url);
        $this->assertStringContainsString('X-Amz-Date=20261009T120000Z', $url);
        $this->assertStringContainsString('X-Amz-Signature=', $url);
        $this->assertStringNotContainsString('private-secret', $url);
        $this->assertSame($url, $signer->signedUrl(
            'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com',
            'fixphone-imagenes', 'media/valuations/TEST.webp',
            'access-key', 'private-secret', 'PUT', 180, 'image/webp', $date,
        ));
    }

    public function test_admin_permissions_and_missing_active_profile(): void
    {
        $this->postJson('/api/v1/admin/valuations/abc/photos/presign', [])->assertUnauthorized();
        $this->auth('technician');
        $this->postJson('/api/v1/admin/valuations/abc/photos/presign', [])->assertForbidden();
    }

    public function test_only_existing_valuation_can_issue_a_signature_and_it_never_returns_secrets(): void
    {
        $this->auth();
        $valuation = $this->valuation();
        $this->postJson('/api/v1/admin/valuations/'.$valuation->id.'/photos/presign', [
            'content_type' => 'image/webp', 'byte_size' => 512,
        ])->assertUnprocessable()->assertJsonValidationErrors(['storage']);

        $this->profile();
        $this->postJson('/api/v1/admin/valuations/not-a-valid-id/photos/presign', [
            'content_type' => 'image/webp', 'byte_size' => 512,
        ])->assertNotFound();

        $granted = $this->grant($valuation->id);
        $this->assertSame(180, $granted['expires_in_seconds']);
        $this->assertSame('image/webp', $granted['content_type']);
        $this->assertStringContainsString('X-Amz-Signature=', $granted['upload_url']);
        $this->assertStringNotContainsString('EXAMPLESECRETKEY123', json_encode($granted));
        $this->assertStringNotContainsString('EXAMPLEACCESSKEY123', json_encode($granted['id']));

        $photo = DeviceValuationPhoto::query()->findOrFail($granted['id']);
        $this->assertSame('pending', $photo->status);
        $this->assertSame(512, $photo->byte_size);
        $this->assertSame('draft', $valuation->fresh()->public_listing_status);
        $this->getJson('/api/v1/admin/valuations/'.$valuation->id.'/photos')
            ->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_rejects_bad_types_and_oversized_uploads_before_signing(): void
    {
        $this->auth();
        $v = $this->valuation();
        $this->profile();
        $this->postJson('/api/v1/admin/valuations/'.$v->id.'/photos/presign', [
            'content_type' => 'text/html', 'byte_size' => 512,
        ])->assertUnprocessable()->assertJsonValidationErrors(['content_type']);
        $this->postJson('/api/v1/admin/valuations/'.$v->id.'/photos/presign', [
            'content_type' => 'image/webp', 'byte_size' => 10000000,
        ])->assertUnprocessable()->assertJsonValidationErrors(['byte_size']);
        $this->assertDatabaseCount('device_valuation_photos', 0);
    }

    public function test_successful_r2_head_verifies_photo_without_publishing_device(): void
    {
        $this->auth();
        $v = $this->valuation();
        $profile = $this->profile();
        $grant = $this->grant($v->id);

        Http::fake([
            '*' => Http::response('', 200, [
                'Content-Type' => 'image/webp',
                'Content-Length' => '512',
            ]),
        ]);
        $this->postJson('/api/v1/admin/valuations/'.$v->id.'/photos/'.$grant['id'].'/confirm')
            ->assertOk()->assertJsonPath('data.id', $grant['id']);

        $photo = DeviceValuationPhoto::query()->findOrFail($grant['id']);
        $this->assertSame('confirmed', $photo->status);
        $this->assertSame($photo->public_url, $v->fresh()->public_image_url);
        $this->assertNotNull($profile->fresh()->verified_at);
        $this->getJson('/api/v1/admin/valuations/'.$v->id.'/photos')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonMissing(['object_key' => $photo->object_key]);
        $this->assertSame('draft', $v->fresh()->public_listing_status);
        Http::assertSentCount(1);
    }

    public function test_invalid_upload_does_not_confirm_or_change_primary_image(): void
    {
        $this->auth();
        $v = $this->valuation();
        $this->profile();
        $grant = $this->grant($v->id, 2000);
        Http::fake(['*' => Http::response('', 200, [
            'Content-Type' => 'image/webp', 'Content-Length' => '500',
        ])]);

        $this->postJson('/api/v1/admin/valuations/'.$v->id.'/photos/'.$grant['id'].'/confirm')
            ->assertUnprocessable()->assertJsonValidationErrors(['photos']);

        $this->assertSame('pending', DeviceValuationPhoto::query()->findOrFail($grant['id'])->status);
        $this->assertNull($v->fresh()->public_image_url);
    }

    public function test_gallery_can_change_primary_and_preserves_original_provider_after_switch(): void
    {
        $this->auth();
        $v = $this->valuation();
        $original = $this->profile();
        Http::fake(['*' => Http::response('', 200, [
            'Content-Type' => 'image/webp', 'Content-Length' => '512',
        ])]);

        $first = $this->grant($v->id);
        $this->postJson('/api/v1/admin/valuations/'.$v->id.'/photos/'.$first['id'].'/confirm')->assertOk();

        $another = MediaStorageProfile::query()->create([
            'name' => 'Client bucket',
            'provider' => 'r2',
            'bucket' => 'customer-images',
            'endpoint_url' => 'https://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.r2.cloudflarestorage.com',
            'public_base_url' => 'https://pub-client.r2.dev',
            'object_prefix' => 'images',
            'access_key_id_encrypted' => Crypt::encryptString('SECONDACCESSKEY123'),
            'secret_access_key_encrypted' => Crypt::encryptString('SECONDSECRETKEY123'),
            'is_selected' => true,
        ]);
        $original->update(['is_selected' => false]);
        $second = $this->grant($v->id);
        $this->postJson('/api/v1/admin/valuations/'.$v->id.'/photos/'.$second['id'].'/confirm')->assertOk();

        $originalPhoto = DeviceValuationPhoto::query()->findOrFail($first['id']);
        $newPhoto = DeviceValuationPhoto::query()->findOrFail($second['id']);
        $this->assertSame($original->id, $originalPhoto->media_storage_profile_id);
        $this->assertSame($another->id, $newPhoto->media_storage_profile_id);
        $this->assertStringStartsWith('https://pub-example.r2.dev/', $originalPhoto->public_url);
        $this->assertStringStartsWith('https://pub-client.r2.dev/', $newPhoto->public_url);

        $this->postJson('/api/v1/admin/valuations/'.$v->id.'/photos/'.$second['id'].'/primary')
            ->assertOk()->assertJsonPath('data.primary_url', $newPhoto->public_url);
        $this->assertSame($newPhoto->public_url, $v->fresh()->public_image_url);

        $this->assertSame(2, count($this->getJson('/api/v1/admin/valuations/'.$v->id.'/photos')->json('data')));
    }

    public function test_expired_photo_cannot_be_verified(): void
    {
        $this->auth();
        $v = $this->valuation();
        $this->profile();
        $grant = $this->grant($v->id);
        DeviceValuationPhoto::query()->findOrFail($grant['id'])->update([
            'upload_expires_at' => now()->subMinutes(5),
        ]);
        $this->postJson('/api/v1/admin/valuations/'.$v->id.'/photos/'.$grant['id'].'/confirm')
            ->assertUnprocessable()->assertJsonValidationErrors(['photos']);
    }
}
