<?php
namespace App\Application\Authentication\Contracts;

interface TokenRevocationGateway
{
 public function revoke(string $plainTextToken): bool;
}
