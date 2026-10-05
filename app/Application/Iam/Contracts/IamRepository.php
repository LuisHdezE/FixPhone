<?php
namespace App\Application\Iam\Contracts;

interface IamRepository
{
 /** @return list<array<string,mixed>> */
 public function listUsers(): array;
 /** @return array<string,mixed>|null */
 public function findUser(string $userId): ?array;
 /** @return array<string,mixed> */
 public function createUser(string $name,string $email,string $password,array $roles): array;
 /** @return array<string,mixed>|null */
 public function updateUser(string $userId,array $changes): ?array;
 public function deactivateUser(string $userId): bool;
 /** @return list<array<string,mixed>> */
 public function listRoles(): array;
 /** @return array<string,mixed>|null */
 public function replaceRoles(string $userId,array $roles): ?array;
 public function rolesExist(array $roles): bool;
 public function emailExists(string $email): bool;
}
