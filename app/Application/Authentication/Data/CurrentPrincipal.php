<?php
namespace App\Application\Authentication\Data;

final readonly class CurrentPrincipal
{
 public function __construct(
  public string $userId,
  public string $name,
  public string $email,
  public array $roles,
  public array $permissions,
 ) {}

 public function toArray(): array
 {
  return [
   'id'=>$this->userId,
   'name'=>$this->name,
   'email'=>$this->email,
   'role'=>$this->roles[0]??null,
   'roles'=>$this->roles,
   'permissions'=>$this->permissions,
  ];
 }
}
