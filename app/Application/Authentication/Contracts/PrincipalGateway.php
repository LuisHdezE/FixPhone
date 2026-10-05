<?php
namespace App\Application\Authentication\Contracts;

use App\Application\Authentication\Data\CurrentPrincipal;

interface PrincipalGateway
{
 public function find(string $userId): ?CurrentPrincipal;
}
