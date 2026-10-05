<?php
namespace App\Application\Authentication\UseCases;

use App\Application\Authentication\Contracts\PrincipalGateway;
use App\Application\Authentication\Data\CurrentPrincipal;

final readonly class GetCurrentUser
{
 public function __construct(private PrincipalGateway $principals) {}

 public function handle(string $userId): ?CurrentPrincipal
 {
  return $this->principals->find($userId);
 }
}
