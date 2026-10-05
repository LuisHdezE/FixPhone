<?php
namespace App\Application\Authorization\Contracts;

interface AuthorizationGateway
{
 /** @return array{roles:list<string>,permissions:list<string>} */
 public function snapshot(string $userId): array;
 public function hasPermission(string $userId,string $permission): bool;
}
