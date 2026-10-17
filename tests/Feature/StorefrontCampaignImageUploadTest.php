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

final class StorefrontCampaignImageUploadTest extends TestCase
{
    use RefreshDatabase;
    private const URL = '/api/v1/admin/store/campaigns/images';
    private function auth(string $role = 'owner'): void
    {
        $user = User::query()->create(['id' => (string) Str::ulid(), 'name' => 'Editor',
            'email' => $role.'@upload.test', 'password' => Hash::make('test-password'), 'active' => true]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => $role]);
        Sanctum::actingAs($user);
    }
    private function image(): UploadedFile
    {
        // Real PNG bytes, without GD dependency; validation must inspect actual content.
        return UploadedFile::fake()->createWithContent('banner.png', base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1sAAAAASUVORK5CYII='));
    }
    private function webp(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('banner.webp', file_get_contents(base_path('web/public/assets/store/hero.webp')));
    }
    private function profile(): MediaStorageProfile
    {
        return MediaStorageProfile::query()->create(['name' => 'R2 test', 'provider' => 'r2',
            'bucket' => 'fixphone-images', 'endpoint_url' => 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com',
            'public_base_url' => 'https://cdn.example.test', 'object_prefix' => 'media',
            'access_key_id_encrypted' => Crypt::encryptString('access-id-example'),
            'secret_access_key_encrypted' => Crypt::encryptString('never-return-this-secret'), 'is_selected' => true]);
    }
    public function test_upload_requires_authentication_and_catalog_permission(): void
    {
        Http::fake();
        $this->postJson(self::URL, [])->assertUnauthorized();
        $this->auth('sales_operator');
        $this->postJson(self::URL, [])->assertForbidden();
        Http::assertNothingSent();
    }
    public function test_missing_or_incomplete_storage_does_not_upload(): void
    {
        Http::fake(); $this->auth();
        $this->postJson(self::URL, ['image' => $this->image()])->assertUnprocessable()->assertJsonValidationErrors('image');
        $profile = $this->profile(); $profile->update(['secret_access_key_encrypted' => null]);
        $this->postJson(self::URL, ['image' => $this->image()])->assertUnprocessable();
        Http::assertNothingSent();
    }
    public function test_nonimages_svg_oversized_and_forged_content_are_rejected(): void
    {
        Http::fake(); $this->auth(); $this->profile();
        foreach ([
            UploadedFile::fake()->createWithContent('fake.png', 'This is not an image'),
            UploadedFile::fake()->createWithContent('image.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
            UploadedFile::fake()->create('huge.png', 2049, 'image/png'),
        ] as $image) {
            $this->postJson(self::URL, ['image' => $image])->assertUnprocessable()->assertJsonValidationErrors('image');
        }
        Http::assertNothingSent();
    }
    public function test_success_uses_selected_profile_unique_names_and_returns_only_verified_public_url(): void
    {
        $this->auth(); $this->profile(); $image = $this->webp(); $bytes = $image->getSize();
        Http::fake(function ($request) use ($bytes) {
            $this->assertStringStartsWith('https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com/fixphone-images/media/store/campaigns/', $request->url());
            return $request->method() === 'PUT' ? Http::response('', 200)
                : Http::response('', 200, ['Content-Length' => (string) $bytes, 'Content-Type' => 'image/webp']);
        });
        $first = $this->postJson(self::URL, ['image' => $image])->assertCreated();
        $this->assertStringContainsString('no-store', $first->headers->get('Cache-Control'));
        $second = $this->postJson(self::URL, ['image' => $this->webp()])->assertCreated();
        $this->assertStringStartsWith('https://cdn.example.test/media/store/campaigns/', $first->json('data.url'));
        $this->assertStringEndsWith('.webp', $first->json('data.url'));
        $this->assertNotSame($first->json('data.url'), $second->json('data.url'));
        $this->assertStringNotContainsString('X-Amz', $first->getContent());
        $this->assertStringNotContainsString('never-return-this-secret', $first->getContent());
        $this->assertDatabaseCount('storefront_campaigns', 0); // Upload never publishes an unsaved draft.
        Http::assertSentCount(4);
    }
    public function test_failed_upload_or_verification_returns_no_url_and_preserves_saved_campaign(): void
    {
        $this->auth(); $this->profile();
        DB::table('storefront_campaigns')->insert(['id' => 1, 'slides' => '[]', 'created_at' => now(), 'updated_at' => now()]);
        $size = (string) $this->image()->getSize();
        Http::fake(['*' => Http::sequence()->push('', 403)
            ->push('', 200)->push('', 404)
            ->push('', 200)->push('', 200, ['Content-Length' => $size, 'Content-Type' => 'text/html'])
            ->push('', 200)->push('', 200, ['Content-Length' => '5', 'Content-Type' => 'image/png'])
            ->push('', 200)->push('', 200, ['Content-Length' => $size.'x', 'Content-Type' => 'image/png'])]);
        foreach (['put', 'head', 'type', 'length', 'invalid-length'] as $failure) {
            $response = $this->postJson(self::URL, ['image' => $this->image()])->assertUnprocessable();
            $this->assertNull($response->json('data.url'));
            $this->assertStringNotContainsString('X-Amz', $response->getContent());
            $this->assertDatabaseHas('storefront_campaigns', ['id' => 1, 'slides' => '[]']);
        }
        Http::assertSentCount(9);
    }
}
