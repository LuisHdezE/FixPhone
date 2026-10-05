<?php
namespace App\Infrastructure\Authentication;

use App\Application\Authentication\Contracts\TokenRevocationGateway;
use Laravel\Sanctum\PersonalAccessToken;

final class SanctumTokenRevocationGateway implements TokenRevocationGateway
{
 public function revoke(string $plainTextToken): bool
 {
  $token=PersonalAccessToken::findToken($plainTextToken);
  return $token!==null && (bool)$token->delete();
 }
}
