<?php
namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class DeviceIntakeOwnershipTest extends TestCase
{
    use RefreshDatabase;

    private function signIn(): void
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(), 'name' => 'Owner',
            'email' => 'owner@ownership.test', 'password' => Hash::make('test-password'), 'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => 'owner']);
        Sanctum::actingAs($user);
    }

    private function payload(): array
    {
        return [
            'title' => 'Apple iPhone 11', 'item_type' => 'used_phone',
            'brand' => 'Apple', 'model' => 'iPhone 11',
            'operational_status' => 'para_deshuesar', 'publication_status' => 'no_publicable',
            'inventory_purpose' => 'parts_donor', 'stock_quantity' => 1, 'is_sellable' => false,
            'metadata' => ['destination' => 'Donor'],
        ];
    }

    private function consignor(): string
    {
        $id = (string) Str::ulid();
        DB::table('consignors')->insert(['id' => $id, 'full_name' => 'Propietario registrado']);
        return $id;
    }

    public function test_owned_intake_persists_without_consignor_and_keeps_destination(): void
    {
        $this->signIn();
        $response = $this->postJson('/api/v1/admin/inventory', $this->payload() + ['ownership_type' => 'owned', 'consignor_id' => null]);
        $response->assertCreated()->assertJsonPath('consignor_id', null)->assertJsonPath('inventory_purpose', 'parts_donor');
        $this->assertDatabaseHas('inventory_items', ['id' => $response->json('id'), 'consignor_id' => null]);
    }

    public function test_consigned_intake_persists_owner_and_keeps_routing_metadata(): void
    {
        $this->signIn();
        $consignor = $this->consignor();
        $response = $this->postJson('/api/v1/admin/inventory', $this->payload() + ['ownership_type' => 'consignment', 'consignor_id' => $consignor]);
        $response->assertCreated()->assertJsonPath('consignor_id', $consignor)
            ->assertJsonPath('inventory_purpose', 'consignation')->assertJsonPath('metadata.destination', 'Donor');
        $this->assertDatabaseHas('inventory_items', ['id' => $response->json('id'), 'consignor_id' => $consignor, 'inventory_purpose' => 'consignation']);
        $audit = DB::table('audit_events')->where('event_type', 'inventory.item_created')->where('entity_id', $response->json('id'))->first();
        $this->assertSame($consignor, json_decode($audit->metadata, true)['payload']['consignor_id']);
        $this->getJson('/api/v1/admin/inventory')->assertOk()->assertJsonFragment(['consignor_id' => $consignor]);
    }

    public function test_missing_or_unknown_consignor_cannot_create_or_consume_a_code(): void
    {
        $this->signIn();
        $next = DB::table('inventory_device_sequences')->where('id', 1)->value('next_number');
        foreach ([null, (string) Str::ulid()] as $consignor) {
            $this->postJson('/api/v1/admin/inventory', $this->payload() + ['ownership_type' => 'consignment', 'consignor_id' => $consignor])
                ->assertUnprocessable()->assertJsonValidationErrors('consignor_id');
        }
        $this->assertDatabaseCount('inventory_items', 0);
        $this->assertDatabaseHas('inventory_device_sequences', ['id' => 1, 'next_number' => $next]);
    }

    public function test_owned_intake_rejects_a_consignor(): void
    {
        $this->signIn();
        $this->postJson('/api/v1/admin/inventory', $this->payload() + ['ownership_type' => 'owned', 'consignor_id' => $this->consignor()])
            ->assertUnprocessable()->assertJsonValidationErrors('ownership_type');
        $this->assertDatabaseCount('inventory_items', 0);
    }

    public function test_legacy_owned_payload_still_works_but_legacy_consignment_requires_owner(): void
    {
        $this->signIn();
        $this->postJson('/api/v1/admin/inventory', $this->payload())->assertCreated();
        $payload = $this->payload();
        $payload['inventory_purpose'] = 'consignation';
        $this->postJson('/api/v1/admin/inventory', $payload)->assertUnprocessable()->assertJsonValidationErrors('consignor_id');
    }
}
