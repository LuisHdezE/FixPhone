<?php
namespace App\Infrastructure\Authentication;

use App\Application\Authentication\Contracts\PrincipalGateway;
use App\Application\Authentication\Data\CurrentPrincipal;
use App\Infrastructure\Identity\User;

final class DatabasePrincipalGateway implements PrincipalGateway
{
 public function find(string $userId): ?CurrentPrincipal
 {
  $user=User::query()->whereKey($userId)->where('active',true)->first();
  if($user===null) return null;

  return new CurrentPrincipal(
   userId:(string)$user->getKey(),
   name:(string)$user->name,
   email:(string)$user->email,
   role:(string)$user->role,
   permissions:[],
  );
 }
}
