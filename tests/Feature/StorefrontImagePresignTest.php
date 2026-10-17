<?php

namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use App\Infrastructure\Media\MediaStorageProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class StorefrontImagePresignTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/admin/store/images/presign';

    private function auth(string $role = 'owner'): void
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => 'Editor',
            'email' => $role.'@presign.test',
            'password' => Hash::make('test-password'),
            'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => $role]);
        Sanctum::actingAs($user);
    }

    private function profile(): void
    {
        MediaStorageProfile::query()->create([
            'name' => 'R2 test', 'provider' => 'r2', 'bucket' => 'fixphone-images',
            'endpoint_url' => 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com',
            'public_base_url' => 'https://cdn.example.test', 'object_prefix' => 'media',
            'access_key_id_encrypted' => Crypt::encryptString('access-id-example'),
            'secret_access_key_encrypted' => Crypt::encryptString('do-not-return-this-secret'),
            'is_selected' => true,
        ]);
    }

    public function test_only_catalog_editors_can_request_upload_grants(): void
    {
        Http::fake();
        $payload = ['kind' => 'models', 'byte_size' => 1024, 'content_type' => 'image/webp'];
        $this->postJson(self::URL, $payload)->assertUnauthorized();
        $this->auth('sales_operator');
        $this->postJson(self::URL, $payload)->assertForbidden();
        Http::assertNothingSent();
    }

    public function test_requires_profile_and_rejects_invalid_metadata_without_network(): void
    {
        Http::fake(); $this->auth();
        $valid = ['kind' => 'models', 'byte_size' => 1024, 'content_type' => 'image/webp'];
        $this->postJson(self::URL, $valid)->assertUnprocessable()->assertJsonValidationErrors('image');
        $this->profile();
        foreach ([
            [array_replace($valid, ['kind' => 'other']), 'kind'],
            [array_replace($valid, ['content_type' => 'image/svg+xml']), 'content_type'],
            [array_replace($valid, ['byte_size' => 2097153]), 'byte_size'],
        ] as [$payload, $field]) {
            $this->postJson(self::URL, $payload)->assertUnprocessable()->assertJsonValidationErrors($field);
        }
        Http::assertNothingSent();
    }

    public function test_generates_unique_scoped_upload_urls_without_hosting_r2_connection(): void
    {
        Http::fake(); $this->auth(); $this->profile();
        foreach (['campaigns', 'products', 'models'] as $kind) {
            $payload = ['kind' => $kind, 'byte_size' => 1024, 'content_type' => 'image/webp'];
            $first = $this->postJson(self::URL, $payload)->assertCreated();
            $second = $this->postJson(self::URL, $payload)->assertCreated();
            $public = $first->json('data.url');
            $signed = $first->json('data.upload_url');
            $this->assertStringStartsWith('https://cdn.example.test/media/store/'.$kind.'/', $public);
            $this->assertStringEndsWith('.webp', $public);
            $this->assertNotSame($public, $second->json('data.url'));
            $this->assertStringStartsWith('https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com/fixphone-images/media/store/'.$kind.'/', $signed);
            $this->assertStringContainsString('X-Amz-Expires=180', $signed);
            $this->assertStringContainsString('X-Amz-SignedHeaders=content-type%3Bhost', $signed);
            $this->assertSame('image/webp', $first->json('data.content_type'));
            $this->assertStringContainsString('no-store', $first->headers->get('Cache-Control'));
            $this->assertStringNotContainsString('do-not-return-this-secret', $first->getContent());
        }
        Http::assertNothingSent();
    }
}
