<?php
namespace App\Infrastructure\Authentication;

use App\Application\Authentication\Contracts\AuthenticationGateway;
use App\Application\Authentication\Data\AuthenticatedSession;
use App\Infrastructure\Identity\User;
use Illuminate\Support\Facades\Hash;

final class SanctumAuthenticationGateway implements AuthenticationGateway
{
 public function authenticate(string $email,string $password,string $tokenName): ?AuthenticatedSession
 {
  $user=User::query()->where('email',$email)->where('active',true)->first();
  if($user===null || !Hash::check($password,(string)$user->password)) return null;

  $token=$user->createToken($tokenName);
  return new AuthenticatedSession(
   userId:(string)$user->getKey(),
   name:(string)$user->name,
   email:(string)$user->email,
   role:(string)$user->role,
   permissions:[],
   accessToken:$token->plainTextToken,
  );
 }
}
