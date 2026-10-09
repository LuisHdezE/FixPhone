<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

final class OwnerBootstrapTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config()->set('fixphone_owner_bootstrap.sha256', hash('sha256', 'test-one-time-key'));
        config()->set('fixphone_owner_bootstrap.expires_at_utc', '2099-01-01T00:00:00Z');
    }

    public function test_bootstrap_requires_the_one_time_key(): void
    {
        $data = ['name' => 'Owner', 'email' => 'owner@example.test', 'password' => 'LongSecret!11'];
        $this->postJson('/api/v1/_internal/bootstrap-owner', $data)->assertNotFound();
        $this->withHeader('X-Owner-Bootstrap-Key', 'invalid')
            ->postJson('/api/v1/_internal/bootstrap-owner', $data)->assertNotFound();
        $this->assertDatabaseCount('users', 0);
    }

    public function test_bootstrap_creates_first_owner_with_hashed_password_and_cannot_repeat(): void
    {
        $this->withHeader('X-Owner-Bootstrap-Key', 'test-one-time-key')
            ->postJson('/api/v1/_internal/bootstrap-owner', [
                'name' => 'Owner', 'email' => 'owner@example.test', 'password' => 'LongSecret!11',
            ])->assertCreated()
            ->assertJsonPath('data.email', 'owner@example.test');

        $user = DB::table('users')->where('email', 'owner@example.test')->first();
        $this->assertNotNull($user);
        $this->assertTrue(Hash::check('LongSecret!11', $user->password));
        $this->assertNotSame('LongSecret!11', $user->password);
        $this->assertDatabaseHas('user_roles', ['user_id' => $user->id, 'role_slug' => 'owner']);
        $this->assertDatabaseHas('audit_events', ['entity_id' => $user->id, 'event_type' => 'ACCESS.OWNER_BOOTSTRAPPED']);
        $this->withHeader('X-Owner-Bootstrap-Key', 'test-one-time-key')
            ->postJson('/api/v1/_internal/bootstrap-owner', [
                'name' => 'Second', 'email' => 'second@example.test', 'password' => 'LongSecret!12',
            ])->assertConflict();
        $this->assertDatabaseCount('users', 1);
    }

    public function test_expired_token_is_rejected(): void
    {
        config()->set('fixphone_owner_bootstrap.expires_at_utc', '2020-01-01T00:00:00Z');
        $this->withHeader('X-Owner-Bootstrap-Key', 'test-one-time-key')
            ->postJson('/api/v1/_internal/bootstrap-owner', [
                'name' => 'Owner', 'email' => 'owner@example.test', 'password' => 'LongSecret!11',
            ])->assertNotFound();
    }
}
