<?php
namespace App\Presentation\Http\Controllers;

use App\Application\Authentication\UseCases\GetCurrentUser;
use App\Presentation\Http\Support\ProblemDetails;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final readonly class AuthMeController
{
 public function __construct(private GetCurrentUser $getCurrentUser) {}

 public function __invoke(Request $request): JsonResponse
 {
  $principal=$this->getCurrentUser->handle((string)$request->user()->getAuthIdentifier());

  if($principal===null){
   return ProblemDetails::response(
    $request,404,'Usuario no encontrado',
    'La identidad autenticada ya no está disponible.',
    'https://fixphone.uy/problems/current-user-not-found',
    'current_user_not_found'
   );
  }

  return response()->json(['data'=>$principal->toArray()]);
 }
}
