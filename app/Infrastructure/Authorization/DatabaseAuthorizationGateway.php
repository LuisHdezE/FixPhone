<?php
namespace App\Infrastructure\Authorization;

use App\Application\Authorization\Contracts\AuthorizationGateway;
use Illuminate\Support\Facades\DB;

final class DatabaseAuthorizationGateway implements AuthorizationGateway
{
 public function snapshot(string $userId): array
 {
  $roles=DB::table('user_roles')->where('user_id',$userId)->orderBy('role_slug')->pluck('role_slug')->values()->all();
  $permissions=DB::table('user_roles as ur')
   ->join('role_permissions as rp','rp.role_slug','=','ur.role_slug')
   ->where('ur.user_id',$userId)
   ->distinct()
   ->orderBy('rp.permission_slug')
   ->pluck('rp.permission_slug')
   ->values()
   ->all();
  return ['roles'=>$roles,'permissions'=>$permissions];
 }

 public function hasPermission(string $userId,string $permission): bool
 {
  return DB::table('user_roles as ur')
   ->join('role_permissions as rp','rp.role_slug','=','ur.role_slug')
   ->where('ur.user_id',$userId)
   ->where('rp.permission_slug',$permission)
   ->exists();
 }
}
