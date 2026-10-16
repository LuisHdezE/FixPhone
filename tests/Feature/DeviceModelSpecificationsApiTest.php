<?php

namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class DeviceModelSpecificationsApiTest extends TestCase
{
    use RefreshDatabase;

    private function signIn(string $role = 'owner'): void
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => 'Tester',
            'email' => Str::ulid().'@test.example',
            'password' => 'test-password',
            'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => $role]);
        Sanctum::actingAs($user);
    }

    public function test_public_cannot_read_or_write_technical_details(): void
    {
        $this->getJson('/api/v1/admin/device-models/model-iphone-11/technical')->assertUnauthorized();
        $this->putJson('/api/v1/admin/device-models/model-iphone-11/technical', ['specs_json' => [], 'source_type' => 'manual'])->assertUnauthorized();
    }

    public function test_owner_can_save_draft_and_create_variant_without_publishing(): void
    {
        $this->signIn();
        $base = '/api/v1/admin/device-models/model-iphone-11';

        $this->putJson($base.'/technical', [
            'specs_json' => ['wifi' => '802.11ax'],
            'source_type' => 'manual',
        ])->assertOk()->assertJsonPath('data.status', 'draft');

        $variant = $this->postJson($base.'/variants', [
            'name' => '4 GB / 128 GB',
            'variant_key' => '4gb-128gb',
            'ram_capacity_id' => 'ram-4gb',
            'storage_capacity_id' => 'storage-128gb',
        ]);
        $variant->assertCreated();
        $this->getJson($base.'/technical')
            ->assertOk()
            ->assertJsonPath('data.specifications.status', 'draft')
            ->assertJsonCount(1, 'data.variants');
        $this->assertDatabaseCount('audit_events', 2);
    }

    public function test_mismatched_catalog_kind_and_unknown_payload_are_rejected(): void
    {
        $this->signIn();
        $this->putJson('/api/v1/admin/device-models/brand-apple/technical', [
            'specs_json' => [],
            'source_type' => 'manual',
        ])->assertUnprocessable();

        $this->putJson('/api/v1/admin/device-models/model-iphone-11/technical', [
            'specs_json' => [], 'source_type' => 'manual', 'status' => 'reviewed',
        ])->assertUnprocessable();

        $this->assertDatabaseCount('device_model_specs', 0);
    }

    public function test_wrong_variant_owner_returns_not_found(): void
    {
        $this->signIn();
        $created = $this->postJson('/api/v1/admin/device-models/model-iphone-11/variants', [
            'name' => 'Base',
            'variant_key' => 'base',
        ])->assertCreated();
        $id = $created->json('data.id');
        $this->putJson('/api/v1/admin/device-models/model-iphone-12/variants/'.$id, [
            'name' => 'Otra',
            'variant_key' => 'otra',
        ])->assertNotFound();
    }
}
