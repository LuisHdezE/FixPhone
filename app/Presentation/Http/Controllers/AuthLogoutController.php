<?php
namespace App\Presentation\Http\Controllers;

use App\Application\Authentication\UseCases\LogoutUser;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final readonly class AuthLogoutController
{
 public function __construct(private LogoutUser $logoutUser) {}

 public function __invoke(Request $request): Response
 {
  $this->logoutUser->handle(
   plainTextToken:(string)$request->bearerToken(),
   userId:(string)$request->user()->getAuthIdentifier(),
   correlationId:$request->attributes->get('correlation_id'),
  );

  return response()->noContent();
 }
}
