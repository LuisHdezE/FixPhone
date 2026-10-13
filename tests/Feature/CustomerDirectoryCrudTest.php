<?php

namespace Tests\Feature;

use App\Infrastructure\Customer\Customer;
use App\Infrastructure\Identity\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class CustomerDirectoryCrudTest extends TestCase
{
    use RefreshDatabase;

    private function signIn(string $role): void
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => $role,
            'email' => (string) Str::ulid().'@fixphone.test',
            'password' => Hash::make('test-password'),
            'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => $role]);
        Sanctum::actingAs($user);
    }

    private function payload(): array
    {
        return [
            'full_name' => 'Cliente real de prueba',
            'phone' => '+598 99 123 456',
            'email' => 'cliente@fixphone.test',
            'relationship_state' => 'active',
            'notes' => 'Contactar por WhatsApp',
        ];
    }

    public function test_unauthenticated_requests_cannot_read_or_modify_customers(): void
    {
        $this->getJson('/api/v1/admin/customers')->assertUnauthorized();
        $this->postJson('/api/v1/admin/customers', $this->payload())->assertUnauthorized();
        $this->patchJson('/api/v1/admin/customers/'.Str::ulid(), $this->payload())->assertUnauthorized();
        $this->deleteJson('/api/v1/admin/customers/'.Str::ulid())->assertUnauthorized();
    }

    public function test_inventory_view_role_cannot_write_customers(): void
    {
        $this->signIn('intake_operator');
        $this->getJson('/api/v1/admin/customers')->assertOk();
        $this->postJson('/api/v1/admin/customers', $this->payload())->assertForbidden();
        $this->patchJson('/api/v1/admin/customers/'.Str::ulid(), $this->payload())->assertForbidden();
        $this->deleteJson('/api/v1/admin/customers/'.Str::ulid())->assertForbidden();
    }

    public function test_owner_can_create_read_edit_and_archive_real_customer(): void
    {
        $this->signIn('owner');

        $created = $this->postJson('/api/v1/admin/customers', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.full_name', 'Cliente real de prueba')
            ->assertJsonPath('data.order_count', null)
            ->assertJsonPath('data.lifetime_value_minor', null)
            ->json('data.id');

        $this->assertDatabaseHas('crm_customers', ['id' => $created, 'deleted_at' => null]);
        $this->getJson('/api/v1/admin/customers')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/admin/customers/'.$created)->assertOk();

        $this->patchJson('/api/v1/admin/customers/'.$created, [
            ...$this->payload(),
            'full_name' => 'Nombre corregido',
            'relationship_state' => 'attention',
        ])->assertOk()->assertJsonPath('data.full_name', 'Nombre corregido')
          ->assertJsonPath('data.relationship_state', 'attention');

        $this->assertDatabaseHas('audit_events', ['entity_id' => $created, 'event_type' => 'customers.created']);
        $this->assertDatabaseHas('audit_events', ['entity_id' => $created, 'event_type' => 'customers.updated']);

        $this->deleteJson('/api/v1/admin/customers/'.$created)->assertOk();
        $this->assertSoftDeleted('crm_customers', ['id' => $created]);
        $this->assertDatabaseHas('audit_events', ['entity_id' => $created, 'event_type' => 'customers.archived']);
        $this->getJson('/api/v1/admin/customers')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/admin/customers/'.$created)->assertNotFound();
        $this->assertSame('Nombre corregido', Customer::withTrashed()->findOrFail($created)->full_name);
    }

    public function test_validation_prevents_missing_contact_invalid_status_and_unsafe_fields(): void
    {
        $this->signIn('owner');

        $this->postJson('/api/v1/admin/customers', [
            ...$this->payload(),
            'phone' => null,
            'email' => null,
        ])->assertUnprocessable()->assertJsonValidationErrors(['phone']);

        $this->postJson('/api/v1/admin/customers', [
            ...$this->payload(),
            'relationship_state' => 'owner',
        ])->assertUnprocessable()->assertJsonValidationErrors(['relationship_state']);

        $this->postJson('/api/v1/admin/customers', [
            ...$this->payload(),
            'lifetime_value_minor' => 100000,
        ])->assertUnprocessable()->assertJsonValidationErrors(['customer']);
    }

    public function test_email_uniqueness_and_deletion_are_safe(): void
    {
        $this->signIn('owner');
        $id = $this->postJson('/api/v1/admin/customers', $this->payload())->assertCreated()->json('data.id');

        $this->postJson('/api/v1/admin/customers', [
            ...$this->payload(), 'full_name' => 'Otro cliente',
        ])->assertUnprocessable()->assertJsonValidationErrors(['email']);

        $this->deleteJson('/api/v1/admin/customers/'.$id)->assertOk();
        $this->deleteJson('/api/v1/admin/customers/'.$id)->assertNotFound();
    }
}
