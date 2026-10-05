<?php

namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class IamEndpointsTest extends TestCase
{
 use RefreshDatabase;

 public function test_owner_can_manage_users_roles_and_permissions(): void
 {
  $owner=$this->createUserWithRole('owner@example.test','owner');
  Sanctum::actingAs($owner);

  $this->getJson('/api/v1/admin/roles')
   ->assertOk()
   ->assertJsonFragment(['slug'=>'owner'])
   ->assertJsonFragment(['slug'=>'technician']);

  $payload=[
   'name'=>'Technician One',
   'email'=>'tech@example.test',
   'password'=>'very-secret-password',
   'roles'=>['technician'],
  ];

  $created=$this->withHeader('Idempotency-Key','iam-create-001')
   ->postJson('/api/v1/admin/users',$payload)
   ->assertCreated()
   ->assertJsonPath('data.email','tech@example.test')
   ->assertJsonPath('data.roles.0','technician');

  $userId=$created->json('data.id');
  $this->assertContains('diagnosis.manage',$created->json('data.permissions'));
  $this->assertNotContains('users.manage',$created->json('data.permissions'));

  $this->withHeader('Idempotency-Key','iam-create-001')
   ->postJson('/api/v1/admin/users',$payload)
   ->assertCreated()
   ->assertJsonPath('data.id',$userId);

  $this->withHeader('Idempotency-Key','iam-create-001')
   ->postJson('/api/v1/admin/users',array_merge($payload,['name'=>'Different']))
   ->assertStatus(409)
   ->assertJsonPath('code','idempotency_conflict');

  $this->getJson('/api/v1/admin/users/'.$userId)
   ->assertOk()
   ->assertJsonPath('data.id',$userId);

  $this->patchJson('/api/v1/admin/users/'.$userId,['name'=>'Technician Updated'])
   ->assertOk()
   ->assertJsonPath('data.name','Technician Updated');

  $roles=$this->putJson('/api/v1/admin/users/'.$userId.'/roles',['roles'=>['inventory_operator']])
   ->assertOk();
  $this->assertContains('inventory.move',$roles->json('data.permissions'));
  $this->assertNotContains('diagnosis.manage',$roles->json('data.permissions'));

  $this->getJson('/api/v1/admin/users')
   ->assertOk()
   ->assertJsonFragment(['email'=>'tech@example.test']);

  $this->postJson('/api/v1/admin/users/'.$userId.'/deactivate')->assertNoContent();
  $this->assertDatabaseHas('users',['id'=>$userId,'active'=>0]);

  $this->assertDatabaseHas('audit_events',['event_type'=>'ACCESS.USER_CREATED','entity_id'=>$userId]);
  $this->assertDatabaseHas('audit_events',['event_type'=>'ACCESS.USER_UPDATED','entity_id'=>$userId]);
  $this->assertDatabaseHas('audit_events',['event_type'=>'ACCESS.ROLE_CHANGED','entity_id'=>$userId]);
  $this->assertDatabaseHas('audit_events',['event_type'=>'ACCESS.PERMISSION_CHANGED','entity_id'=>$userId]);
  $this->assertDatabaseHas('audit_events',['event_type'=>'ACCESS.USER_DEACTIVATED','entity_id'=>$userId]);
 }

 public function test_user_without_users_manage_is_forbidden_even_with_direct_api_call(): void
 {
  $technician=$this->createUserWithRole('tech@example.test','technician');
  Sanctum::actingAs($technician);

  $this->getJson('/api/v1/admin/users')
   ->assertForbidden()
   ->assertJsonPath('code','http_403');

  $this->postJson('/api/v1/admin/users',[
   'name'=>'Forbidden',
   'email'=>'forbidden@example.test',
   'password'=>'very-secret-password',
   'roles'=>['technician'],
  ],['Idempotency-Key'=>'forbidden-001'])
   ->assertForbidden();

  $this->assertDatabaseMissing('users',['email'=>'forbidden@example.test']);
 }

 public function test_create_requires_valid_role_and_idempotency_key(): void
 {
  $owner=$this->createUserWithRole('owner2@example.test','owner');
  Sanctum::actingAs($owner);

  $this->postJson('/api/v1/admin/users',[
   'name'=>'No Key',
   'email'=>'nokey@example.test',
   'password'=>'very-secret-password',
   'roles'=>['technician'],
  ])->assertStatus(422);

  $this->withHeader('Idempotency-Key','bad-role-001')
   ->postJson('/api/v1/admin/users',[
    'name'=>'Bad Role',
    'email'=>'badrole@example.test',
    'password'=>'very-secret-password',
    'roles'=>['does_not_exist'],
   ])->assertStatus(422)
    ->assertJsonPath('errors.roles.0','Uno o más roles no existen.');
 }

 public function test_admin_cannot_deactivate_self_through_iam_endpoint(): void
 {
  $owner=$this->createUserWithRole('owner3@example.test','owner');
  Sanctum::actingAs($owner);

  $this->postJson('/api/v1/admin/users/'.$owner->getKey().'/deactivate')
   ->assertStatus(409)
   ->assertJsonPath('code','self_deactivation_not_allowed');

  $this->assertDatabaseHas('users',['id'=>(string)$owner->getKey(),'active'=>1]);
 }

 private function createUserWithRole(string $email,string $role): User
 {
  $user=User::query()->create([
   'id'=>(string)Str::ulid(),
   'name'=>'IAM Test',
   'email'=>$email,
   'password'=>Hash::make('secret-password'),
   'active'=>true,
  ]);
  DB::table('user_roles')->insert(['user_id'=>(string)$user->getKey(),'role_slug'=>$role]);
  return $user;
 }
}
