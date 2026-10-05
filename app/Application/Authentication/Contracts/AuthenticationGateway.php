<?php
namespace App\Application\Authentication\Contracts;

use App\Application\Authentication\Data\AuthenticatedSession;

interface AuthenticationGateway
{
 public function authenticate(string $email,string $password,string $tokenName): ?AuthenticatedSession;
}
