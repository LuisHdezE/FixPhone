<?php
namespace App\Presentation\Http\Controllers;

use App\Application\Authentication\UseCases\LoginUser;
use App\Presentation\Http\Support\LoginRequestValidator;
use App\Presentation\Http\Support\ProblemDetails;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final readonly class AuthLoginController
{
 public function __construct(
  private LoginUser $loginUser,
  private LoginRequestValidator $validator,
 ) {}

 public function __invoke(Request $request): JsonResponse
 {
  $credentials=$this->validator->validate($request);
  $session=$this->loginUser->handle(
   email:$credentials['email'],
   password:$credentials['password'],
   tokenName:$credentials['device_name']??'api-client',
   correlationId:$request->attributes->get('correlation_id'),
  );

  if($session===null){
   return ProblemDetails::response(
    $request,401,'Credenciales inválidas',
    'El correo electrónico o la contraseña no son correctos.',
    'https://fixphone.uy/problems/invalid-credentials',
    'invalid_credentials'
   );
  }

  return response()->json(['data'=>$session->toArray()]);
 }
}
