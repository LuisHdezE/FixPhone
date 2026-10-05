<?php

namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

final class AuthenticationEndpointsTest extends TestCase
{
 use RefreshDatabase;

 public function test_active_user_can_login_read_current_profile_and_logout_with_effective_permissions(): void
 {
  $user=$this->createUserWithRole('owner@example.test','owner',true);

  $login=$this->withHeader('X-Correlation-ID','auth-flow-001')
   ->postJson('/api/v1/auth/login',[
    'email'=>'OWNER@example.test',
    'password'=>'secret-password',
    'device_name'=>'phpunit',
   ])
   ->assertOk()
   ->assertJsonPath('data.user.id',(string)$user->getKey())
   ->assertJsonPath('data.user.role','owner')
   ->assertJsonPath('data.user.roles.0','owner')
   ->assertJsonPath('data.token_type','Bearer');

  $permissions=$login->json('data.user.permissions');
  $this->assertContains('users.manage',$permissions);
  $this->assertContains('inventory.adjust',$permissions);

  $token=$login->json('data.access_token');
  $this->assertIsString($token);
  $this->assertNotNull(PersonalAccessToken::findToken($token));

  $me=$this->withToken($token)->getJson('/api/v1/auth/me')->assertOk();
  $this->assertContains('users.manage',$me->json('data.permissions'));

  $this->withHeader('X-Correlation-ID','auth-flow-logout')
   ->withToken($token)
   ->postJson('/api/v1/auth/logout')
   ->assertNoContent();

  $this->assertNull(PersonalAccessToken::findToken($token));
  $this->assertDatabaseHas('audit_events',['event_type'=>'AUTH.LOGIN.SUCCESS','entity_id'=>(string)$user->getKey()]);
  $this->assertDatabaseHas('audit_events',['event_type'=>'AUTH.LOGOUT','entity_id'=>(string)$user->getKey()]);
 }

 public function test_invalid_credentials_are_rejected_and_audited_without_plain_email(): void
 {
  $this->createUserWithRole('staff@example.test','sales_operator',true);

  $this->postJson('/api/v1/auth/login',[
   'email'=>'staff@example.test',
   'password'=>'wrong-password',
  ])->assertStatus(401)
   ->assertJsonPath('code','invalid_credentials');

  $event=DB::table('audit_events')->where('event_type','AUTH.LOGIN.FAILURE')->first();
  $this->assertNotNull($event);
  $this->assertStringNotContainsString('staff@example.test',(string)$event->metadata);
 }

 public function test_inactive_user_cannot_login(): void
 {
  $this->createUserWithRole('inactive@example.test','sales_operator',false);

  $this->postJson('/api/v1/auth/login',[
   'email'=>'inactive@example.test',
   'password'=>'secret-password',
  ])->assertStatus(401);
 }

 public function test_me_and_logout_require_authentication(): void
 {
  $this->getJson('/api/v1/auth/me')->assertUnauthorized();
  $this->postJson('/api/v1/auth/logout')->assertUnauthorized();
 }

 public function test_login_validation_uses_problem_details(): void
 {
  $this->postJson('/api/v1/auth/login',[])
   ->assertStatus(422)
   ->assertHeader('content-type','application/problem+json')
   ->assertJsonPath('code','http_422')
   ->assertJsonPath('errors.email.0','El correo electrónico es obligatorio.')
   ->assertJsonPath('errors.password.0','La contraseña es obligatoria.');
 }

 private function createUserWithRole(string $email,string $role,bool $active): User
 {
  $user=User::query()->create([
   'id'=>(string)Str::ulid(),
   'name'=>'Auth Test',
   'email'=>$email,
   'password'=>Hash::make('secret-password'),
   'active'=>$active,
  ]);
  DB::table('user_roles')->insert(['user_id'=>(string)$user->getKey(),'role_slug'=>$role]);
  return $user;
 }
}
