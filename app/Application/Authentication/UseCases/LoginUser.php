<?php
namespace App\Application\Authentication\UseCases;

use App\Application\Authentication\Contracts\AuthenticationGateway;
use App\Application\Authentication\Data\AuthenticatedSession;
use App\Application\Shared\Contracts\AuditTrail;

final readonly class LoginUser
{
 public function __construct(
  private AuthenticationGateway $authentication,
  private AuditTrail $audit,
 ) {}

 public function handle(string $email,string $password,string $tokenName,?string $correlationId): ?AuthenticatedSession
 {
  $normalized=mb_strtolower(trim($email));
  $session=$this->authentication->authenticate(
   $normalized,
   $password,
   trim($tokenName)===''?'api-client':trim($tokenName),
  );

  if($session===null){
   $this->audit->record('AUTH.LOGIN.FAILURE','login','authentication','unknown','anonymous',null,$correlationId,[
    'email_hash'=>hash('sha256',$normalized),
   ]);
   return null;
  }

  $this->audit->record('AUTH.LOGIN.SUCCESS','login','user',$session->userId,'user',$session->userId,$correlationId);
  return $session;
 }
}
