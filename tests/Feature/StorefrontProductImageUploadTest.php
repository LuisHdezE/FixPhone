<?php
namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use App\Infrastructure\Media\MediaStorageProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class StorefrontProductImageUploadTest extends TestCase
{
    use RefreshDatabase;
    private const URL = '/api/v1/admin/store/products/images';

    private function auth(string $role = 'owner'): void
    {
        $user = User::query()->create(['id' => (string) Str::ulid(), 'name' => 'Editor',
            'email' => $role.'@product-image.test', 'password' => Hash::make('test-password'), 'active' => true]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => $role]);
        Sanctum::actingAs($user);
    }

    private function profile(): void
    {
        MediaStorageProfile::query()->create(['name' => 'R2 test', 'provider' => 'r2',
            'bucket' => 'fixphone-images', 'endpoint_url' => 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com',
            'public_base_url' => 'https://cdn.example.test', 'object_prefix' => 'media',
            'access_key_id_encrypted' => Crypt::encryptString('access-id-example'),
            'secret_access_key_encrypted' => Crypt::encryptString('do-not-return-this-secret'), 'is_selected' => true]);
    }

    private function image(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('product.webp', file_get_contents(base_path('web/public/assets/store/hero.webp')));
    }

    public function test_product_upload_requires_catalog_permission(): void
    {
        Http::fake();
        $this->postJson(self::URL, ['image' => $this->image()])->assertUnauthorized();
        $this->auth('sales_operator');
        $this->postJson(self::URL, ['image' => $this->image()])->assertForbidden();
        Http::assertNothingSent();
    }

    public function test_missing_profile_and_invalid_images_are_rejected_without_r2_request(): void
    {
        Http::fake(); $this->auth();
        $this->postJson(self::URL, ['image' => $this->image()])->assertUnprocessable()->assertJsonValidationErrors('image');
        $this->profile();
        foreach ([
            UploadedFile::fake()->createWithContent('fake.png', 'fake image bytes'),
            UploadedFile::fake()->createWithContent('script.svg', '<svg onload="alert(1)"/>'),
            UploadedFile::fake()->create('huge.png', 2049, 'image/png'),
        ] as $invalid) {
            $this->postJson(self::URL, ['image' => $invalid])->assertUnprocessable()->assertJsonValidationErrors('image');
        }
        Http::assertNothingSent();
    }

    public function test_verified_product_image_has_unique_public_url_without_mutating_inventory(): void
    {
        $this->auth(); $this->profile(); $bytes = $this->image()->getSize();
        Http::fake(function ($request) use ($bytes) {
            $this->assertStringStartsWith('https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com/fixphone-images/media/store/products/', $request->url());
            return $request->method() === 'PUT' ? Http::response('', 200)
                : Http::response('', 200, ['Content-Length' => (string) $bytes, 'Content-Type' => 'image/webp']);
        });
        $first = $this->postJson(self::URL, ['image' => $this->image()])->assertCreated();
        $second = $this->postJson(self::URL, ['image' => $this->image()])->assertCreated();
        $this->assertStringStartsWith('https://cdn.example.test/media/store/products/', $first->json('data.url'));
        $this->assertStringEndsWith('.webp', $first->json('data.url'));
        $this->assertNotSame($first->json('data.url'), $second->json('data.url'));
        $this->assertStringContainsString('no-store', $first->headers->get('Cache-Control'));
        $this->assertStringNotContainsString('X-Amz', $first->getContent());
        $this->assertStringNotContainsString('do-not-return-this-secret', $first->getContent());
        $this->assertDatabaseCount('inventory_items', 0);
        Http::assertSentCount(4);
    }

    public function test_failed_verification_returns_no_public_url(): void
    {
        $this->auth(); $this->profile();
        Http::fake(['*' => Http::sequence()->push('', 200)->push('', 404)]);
        $response = $this->postJson(self::URL, ['image' => $this->image()])->assertUnprocessable();
        $this->assertNull($response->json('data.url'));
        $this->assertStringNotContainsString('X-Amz', $response->getContent());
        Http::assertSentCount(2);
    }
}
