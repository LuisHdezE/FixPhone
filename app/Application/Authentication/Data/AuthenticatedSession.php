<?php
namespace App\Application\Authentication\Data;

final readonly class AuthenticatedSession
{
 public function __construct(
  public string $userId,
  public string $name,
  public string $email,
  public array $roles,
  public array $permissions,
  public string $accessToken,
 ) {}

 public function toArray(): array
 {
  return [
   'user'=>[
    'id'=>$this->userId,
    'name'=>$this->name,
    'email'=>$this->email,
    'role'=>$this->roles[0]??null,
    'roles'=>$this->roles,
    'permissions'=>$this->permissions,
   ],
   'access_token'=>$this->accessToken,
   'token_type'=>'Bearer',
  ];
 }
}
