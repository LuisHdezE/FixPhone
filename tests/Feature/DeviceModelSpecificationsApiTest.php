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

    public function test_specification_update_records_before_and_after_and_does_not_duplicate(): void
    {
        $this->signIn();
        $url = '/api/v1/admin/device-models/model-iphone-11/technical';

        $this->putJson($url, [
            'specs_json' => ['wifi' => '802.11ac'],
            'source_type' => 'manual',
        ])->assertOk();

        $this->putJson($url, [
            'specs_json' => ['wifi' => '802.11ax'],
            'source_type' => 'manual',
        ])->assertOk();

        $this->assertDatabaseCount('device_model_specs', 1);
        $lastEvent = DB::table('audit_events')
            ->where('event_type', 'device_model.specifications_saved')
            ->orderByDesc('occurred_at')
            ->orderByDesc('id')
            ->first();
        $this->assertNotNull($lastEvent);
        $events = DB::table('audit_events')
            ->where('event_type', 'device_model.specifications_saved')
            ->get()
            ->map(fn ($event) => json_decode($event->metadata, true))
            ->all();
        $this->assertCount(2, $events);
        $this->assertContains(['wifi' => '802.11ac'], array_column(array_column($events, 'before'), 'specs_json'));
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
    public function test_repeated_spec_save_is_idempotent_and_empty_specs_can_be_saved(): void
    {
        $this->signIn();
        $url = '/api/v1/admin/device-models/model-iphone-11/technical';
        $payload = ['specs_json' => ['wifi' => '802.11ax'], 'source_type' => 'manual'];
        $this->putJson($url, $payload)->assertOk();
        $this->putJson($url, $payload)->assertOk();
        $this->assertDatabaseCount('audit_events', 1);
        $this->putJson($url, ['specs_json' => [], 'source_type' => 'manual'])->assertOk();
        $this->getJson($url)->assertOk()->assertJsonPath('data.specifications.specs_json', []);
    }

    public function test_invalid_spec_shapes_and_duplicate_variant_keys_return_validation_errors(): void
    {
        $this->signIn();
        $base = '/api/v1/admin/device-models/model-iphone-11';
        foreach ([['wifi' => ['invalid']], ['wifi' => str_repeat('a', 2001)], ['list-value']] as $specs) {
            $this->putJson($base.'/technical', ['specs_json' => $specs, 'source_type' => 'manual'])->assertUnprocessable();
        }
        $variant = ['name' => 'Base', 'variant_key' => 'base'];
        $first = $this->postJson($base.'/variants', $variant)->assertCreated()->json('data.id');
        $this->postJson($base.'/variants', $variant)->assertUnprocessable()->assertJsonValidationErrors('variant_key');
        $this->putJson($base.'/variants/'.$first, $variant)->assertOk();
        $this->assertDatabaseCount('device_model_variants', 1);
    }

    public function test_authenticated_user_without_catalog_permission_cannot_read_or_write(): void
    {
        $this->signIn('intake_operator');
        $base = '/api/v1/admin/device-models/model-iphone-11';
        $this->getJson($base.'/technical')->assertForbidden();
        $this->putJson($base.'/technical', ['specs_json' => [], 'source_type' => 'manual'])->assertForbidden();
        $this->postJson($base.'/variants', ['name' => 'Base', 'variant_key' => 'base'])->assertForbidden();
    }

}
