<?php
namespace App\Infrastructure\Iam;

use App\Application\Authorization\Contracts\AuthorizationGateway;
use App\Application\Iam\Contracts\IamRepository;
use App\Infrastructure\Identity\Role;
use App\Infrastructure\Identity\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

final readonly class DatabaseIamRepository implements IamRepository
{
 public function __construct(private AuthorizationGateway $authorization) {}

 public function listUsers(): array
 {
  return User::query()->orderBy('name')->get()->map(fn(User $user)=>$this->project($user))->all();
 }

 public function findUser(string $userId): ?array
 {
  $user=User::query()->find($userId);
  return $user? $this->project($user):null;
 }

 public function createUser(string $name,string $email,string $password,array $roles): array
 {
  return DB::transaction(function () use ($name,$email,$password,$roles): array {
   $user=User::query()->create([
    'id'=>(string)Str::ulid(),
    'name'=>trim($name),
    'email'=>mb_strtolower(trim($email)),
    'password'=>Hash::make($password),
    'active'=>true,
   ]);
   DB::table('user_roles')->insert(array_map(
    static fn(string $role): array=>['user_id'=>(string)$user->getKey(),'role_slug'=>$role],
    array_values(array_unique($roles))
   ));
   return $this->project($user);
  });
 }

 public function updateUser(string $userId,array $changes): ?array
 {
  $user=User::query()->find($userId);
  if($user===null) return null;

  $update=[];
  if(array_key_exists('name',$changes)) $update['name']=trim((string)$changes['name']);
  if(array_key_exists('email',$changes)) $update['email']=mb_strtolower(trim((string)$changes['email']));
  if(array_key_exists('password',$changes)) $update['password']=Hash::make((string)$changes['password']);
  if($update!==[]) $user->fill($update)->save();

  return $this->project($user->fresh());
 }

 public function deactivateUser(string $userId): bool
 {
  return DB::transaction(function () use ($userId): bool {
   $user=User::query()->find($userId);
   if($user===null) return false;
   $user->active=false;
   $user->save();
   $user->tokens()->delete();
   return true;
  });
 }

 public function listRoles(): array
 {
  return Role::query()->with('permissions')->orderBy('slug')->get()->map(
   static fn(Role $role): array=>[
    'slug'=>(string)$role->slug,
    'name'=>(string)$role->name,
    'system'=>(bool)$role->system,
    'permissions'=>$role->permissions->pluck('slug')->sort()->values()->all(),
   ]
  )->all();
 }

 public function replaceRoles(string $userId,array $roles): ?array
 {
  $user=User::query()->find($userId);
  if($user===null) return null;

  DB::transaction(function () use ($userId,$roles): void {
   DB::table('user_roles')->where('user_id',$userId)->delete();
   $rows=array_map(
    static fn(string $role): array=>['user_id'=>$userId,'role_slug'=>$role],
    array_values(array_unique($roles))
   );
   if($rows!==[]) DB::table('user_roles')->insert($rows);
  });

  return $this->project($user->fresh());
 }

 public function rolesExist(array $roles): bool
 {
  $unique=array_values(array_unique($roles));
  return count($unique)===DB::table('roles')->whereIn('slug',$unique)->count();
 }

 private function project(User $user): array
 {
  $snapshot=$this->authorization->snapshot((string)$user->getKey());
  return [
   'id'=>(string)$user->getKey(),
   'name'=>(string)$user->name,
   'email'=>(string)$user->email,
   'active'=>(bool)$user->active,
   'roles'=>$snapshot['roles'],
   'permissions'=>$snapshot['permissions'],
  ];
 }
}
