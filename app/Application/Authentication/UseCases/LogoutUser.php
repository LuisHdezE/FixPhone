<?php
namespace App\Application\Authentication\UseCases;

use App\Application\Authentication\Contracts\TokenRevocationGateway;
use App\Application\Shared\Contracts\AuditTrail;

final readonly class LogoutUser
{
 public function __construct(
  private TokenRevocationGateway $tokens,
  private AuditTrail $audit,
 ) {}

 public function handle(string $plainTextToken,string $userId,?string $correlationId): bool
 {
  if($plainTextToken==='') return false;
  $revoked=$this->tokens->revoke($plainTextToken);
  if($revoked){
   $this->audit->record('AUTH.LOGOUT','logout','user',$userId,'user',$userId,$correlationId);
  }
  return $revoked;
 }
}
