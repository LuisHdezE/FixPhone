<?php

namespace Tests\Feature;

use App\Infrastructure\Media\MediaStorageProfileResolver;
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

final class MediaStorageSettingsTest extends TestCase
{
    use RefreshDatabase;

    private function signIn(string $role): void
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => 'Media Test',
            'email' => $role.'-media@example.test',
            'password' => Hash::make('testing-private-password'),
            'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => $role]);
        Sanctum::actingAs($user);
    }

    private function profile(string $name = 'R2 desarrollo'): array
    {
        return [
            'name' => $name,
            'provider' => 'r2',
            'bucket' => 'fixphone-imagenes',
            'endpoint_url' => 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com',
            'public_base_url' => 'https://pub-example.r2.dev',
            'object_prefix' => 'phones/donor',
            'access_key_id' => 'PRIVATE-ACCESS-KEY-123',
            'secret_access_key' => 'PRIVATE-SECRET-KEY-456',
        ];
    }

    public function test_only_authorized_admins_can_manage_settings(): void
    {
        $this->getJson('/api/v1/admin/media/storage-profiles')->assertUnauthorized();
        $this->postJson('/api/v1/admin/media/storage-profiles', $this->profile())->assertUnauthorized();

        $this->signIn('sales_operator');
        $this->getJson('/api/v1/admin/media/storage-profiles')->assertForbidden();
        $this->postJson('/api/v1/admin/media/storage-profiles', $this->profile())->assertForbidden();
    }

    public function test_credentials_are_encrypted_and_never_returned_or_audited(): void
    {
        $this->signIn('owner');
        $created = $this->postJson('/api/v1/admin/media/storage-profiles', $this->profile())
            ->assertCreated()
            ->assertJsonPath('data.bucket', 'fixphone-imagenes')
            ->assertJsonPath('data.is_selected', false)
            ->assertJsonPath('data.has_credentials', true)
            ->assertJsonPath('data.connection_status', 'not_tested');
        $id = $created->json('data.id');

        $stored = MediaStorageProfile::query()->findOrFail($id);
        $this->assertNotSame('PRIVATE-ACCESS-KEY-123', $stored->access_key_id_encrypted);
        $this->assertNotSame('PRIVATE-SECRET-KEY-456', $stored->secret_access_key_encrypted);
        $this->assertSame('PRIVATE-ACCESS-KEY-123', Crypt::decryptString($stored->access_key_id_encrypted));
        $this->assertSame('PRIVATE-SECRET-KEY-456', Crypt::decryptString($stored->secret_access_key_encrypted));

        $listed = $this->getJson('/api/v1/admin/media/storage-profiles')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.has_credentials', true);
        foreach ([$created->getContent(), $listed->getContent()] as $body) {
            $this->assertStringNotContainsString('PRIVATE-ACCESS-KEY-123', $body);
            $this->assertStringNotContainsString('PRIVATE-SECRET-KEY-456', $body);
            $this->assertStringNotContainsString('encrypted', $body);
        }
        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'MEDIA.STORAGE_PROFILE_CREATED',
            'entity_id' => $id,
        ]);
        foreach (DB::table('audit_events')->where('entity_id', $id)->pluck('metadata') as $metadata) {
            $this->assertStringNotContainsString('PRIVATE-', (string) $metadata);
        }
    }

    public function test_credentials_remain_when_blank_and_can_be_rotated(): void
    {
        $this->signIn('administrator');
        $id = $this->postJson('/api/v1/admin/media/storage-profiles', $this->profile())
            ->assertCreated()->json('data.id');

        $this->patchJson('/api/v1/admin/media/storage-profiles/'.$id, [
            'name' => 'Cliente final',
            'access_key_id' => '',
            'secret_access_key' => '',
        ])->assertOk()->assertJsonPath('data.name', 'Cliente final');

        $profile = MediaStorageProfile::query()->findOrFail($id);
        $this->assertSame('PRIVATE-SECRET-KEY-456', Crypt::decryptString($profile->secret_access_key_encrypted));

        $this->patchJson('/api/v1/admin/media/storage-profiles/'.$id, [
            'secret_access_key' => 'ROTATED-PRIVATE-SECRET-789',
        ])->assertOk();
        $this->assertSame('ROTATED-PRIVATE-SECRET-789', Crypt::decryptString($profile->fresh()->secret_access_key_encrypted));
    }

    public function test_only_one_profile_is_preferred_and_resolver_is_server_side_only(): void
    {
        $this->signIn('owner');
        $first = $this->postJson('/api/v1/admin/media/storage-profiles', $this->profile())
            ->assertCreated()->json('data.id');
        $other = [
            ...$this->profile('R2 cliente'),
            'bucket' => 'customer-assets',
            'object_prefix' => 'public',
            'access_key_id' => 'CUSTOMER-ACCESS-KEY',
            'secret_access_key' => 'CUSTOMER-SECRET-KEY',
        ];
        $second = $this->postJson('/api/v1/admin/media/storage-profiles', $other)->assertCreated()->json('data.id');

        $this->postJson('/api/v1/admin/media/storage-profiles/'.$first.'/select')
            ->assertOk()->assertJsonPath('data.is_selected', true);
        $this->postJson('/api/v1/admin/media/storage-profiles/'.$second.'/select')
            ->assertOk()->assertJsonPath('data.is_selected', true);

        $this->assertDatabaseCount('media_storage_profiles', 2);
        $this->assertSame(1, MediaStorageProfile::query()->where('is_selected', true)->count());
        $this->assertSame($second, MediaStorageProfile::query()->where('is_selected', true)->value('id'));

        $resolved = app(MediaStorageProfileResolver::class)->selected();
        $this->assertSame('customer-assets', $resolved['bucket']);
        $this->assertSame('CUSTOMER-ACCESS-KEY', $resolved['access_key_id']);
        $this->assertSame('CUSTOMER-SECRET-KEY', $resolved['secret_access_key']);
        $this->assertStringNotContainsString('CUSTOMER-SECRET-KEY', $this->getJson('/api/v1/admin/media/storage-profiles')->getContent());
    }

    public function test_changing_selected_destination_requires_reselection(): void
    {
        $this->signIn('owner');
        $id = $this->postJson('/api/v1/admin/media/storage-profiles', $this->profile())
            ->assertCreated()->json('data.id');
        $this->postJson('/api/v1/admin/media/storage-profiles/'.$id.'/select')
            ->assertOk()->assertJsonPath('data.is_selected', true);

        $this->patchJson('/api/v1/admin/media/storage-profiles/'.$id, [
            'name' => 'Nueva etiqueta',
        ])->assertOk()->assertJsonPath('data.is_selected', true);

        $this->patchJson('/api/v1/admin/media/storage-profiles/'.$id, [
            'bucket' => 'new-client-bucket',
        ])->assertOk()->assertJsonPath('data.is_selected', false);

        $this->assertSame(0, MediaStorageProfile::query()->where('is_selected', true)->count());
        $this->assertNull(app(MediaStorageProfileResolver::class)->selected());
    }

    public function test_incomplete_profile_cannot_be_preferred(): void
    {
        $this->signIn('owner');
        $data = $this->profile();
        unset($data['public_base_url'], $data['secret_access_key']);
        $id = $this->postJson('/api/v1/admin/media/storage-profiles', $data)
            ->assertCreated()->json('data.id');

        $this->postJson('/api/v1/admin/media/storage-profiles/'.$id.'/select')
            ->assertUnprocessable()->assertJsonValidationErrors(['profile']);
    }

    public function test_connection_probe_checks_credentials_without_uploading_or_exposing_keys(): void
    {
        $this->signIn('owner');
        $id = $this->postJson('/api/v1/admin/media/storage-profiles', $this->profile())
            ->assertCreated()->json('data.id');

        Http::fake(['*' => Http::response('', 404)]);
        $response = $this->postJson('/api/v1/admin/media/storage-profiles/'.$id.'/test')
            ->assertOk()->assertJsonPath('data.reachable', true);
        $this->assertStringNotContainsString('PRIVATE-ACCESS-KEY-123', $response->getContent());
        $this->assertStringNotContainsString('PRIVATE-SECRET-KEY-456', $response->getContent());
        $this->assertNull(MediaStorageProfile::query()->findOrFail($id)->verified_at);
        Http::assertSentCount(1);
    }

    public function test_connection_probe_rejects_bad_r2_credentials_without_changing_selected_profile(): void
    {
        $this->signIn('owner');
        $id = $this->postJson('/api/v1/admin/media/storage-profiles', $this->profile())
            ->assertCreated()->json('data.id');

        Http::fake(['*' => Http::response('', 403)]);
        $this->postJson('/api/v1/admin/media/storage-profiles/'.$id.'/test')
            ->assertUnprocessable()->assertJsonValidationErrors(['profile']);
        $this->assertNull(MediaStorageProfile::query()->findOrFail($id)->verified_at);
    }

    public function test_invalid_storage_endpoint_is_rejected(): void
    {
        $this->signIn('owner');

        foreach ([
            'http://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com',
            'https://127.0.0.1',
            'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com/fixphone-imagenes',
            'https://evil.example.com',
            'https://user:password@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com',
        ] as $endpoint) {
            $this->postJson('/api/v1/admin/media/storage-profiles', [
                ...$this->profile(), 'endpoint_url' => $endpoint,
            ])->assertUnprocessable();
        }

        $this->assertDatabaseCount('media_storage_profiles', 0);
    }
}
