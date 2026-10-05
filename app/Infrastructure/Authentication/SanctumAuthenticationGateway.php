<?php
namespace App\Infrastructure\Authentication;

use App\Application\Authentication\Contracts\AuthenticationGateway;
use App\Application\Authentication\Data\AuthenticatedSession;
use App\Application\Authorization\Contracts\AuthorizationGateway;
use App\Infrastructure\Identity\User;
use Illuminate\Support\Facades\Hash;

final readonly class SanctumAuthenticationGateway implements AuthenticationGateway
{
 public function __construct(private AuthorizationGateway $authorization) {}

 public function authenticate(string $email,string $password,string $tokenName): ?AuthenticatedSession
 {
  $user=User::query()->where('email',$email)->where('active',true)->first();
  if($user===null || !Hash::check($password,(string)$user->password)) return null;

  $snapshot=$this->authorization->snapshot((string)$user->getKey());
  $token=$user->createToken($tokenName);

  return new AuthenticatedSession(
   userId:(string)$user->getKey(),
   name:(string)$user->name,
   email:(string)$user->email,
   roles:$snapshot['roles'],
   permissions:$snapshot['permissions'],
   accessToken:$token->plainTextToken,
  );
 }
}
