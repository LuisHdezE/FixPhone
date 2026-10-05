<?php
namespace App\Infrastructure\Authentication;

use App\Application\Authentication\Contracts\PrincipalGateway;
use App\Application\Authentication\Data\CurrentPrincipal;
use App\Application\Authorization\Contracts\AuthorizationGateway;
use App\Infrastructure\Identity\User;

final readonly class DatabasePrincipalGateway implements PrincipalGateway
{
 public function __construct(private AuthorizationGateway $authorization) {}

 public function find(string $userId): ?CurrentPrincipal
 {
  $user=User::query()->whereKey($userId)->where('active',true)->first();
  if($user===null) return null;

  $snapshot=$this->authorization->snapshot((string)$user->getKey());

  return new CurrentPrincipal(
   userId:(string)$user->getKey(),
   name:(string)$user->name,
   email:(string)$user->email,
   roles:$snapshot['roles'],
   permissions:$snapshot['permissions'],
  );
 }
}
