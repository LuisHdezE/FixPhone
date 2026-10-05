<?php
namespace App\Presentation\Http\Controllers;

use App\Application\Iam\Exceptions\IdempotencyConflict;
use App\Application\Iam\IamService;
use App\Presentation\Http\Support\ProblemDetails;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

final readonly class IamController
{
 public function __construct(private IamService $iam) {}

 public function usersList(): JsonResponse
 {
  return response()->json(['data'=>$this->iam->usersList()]);
 }

 public function usersShow(Request $request,string $userId): JsonResponse
 {
  $user=$this->iam->userShow($userId);
  return $user!==null
   ? response()->json(['data'=>$user])
   : ProblemDetails::response($request,404,'Usuario no encontrado','El usuario solicitado no existe.','https://fixphone.uy/problems/user-not-found','user_not_found');
 }

 public function usersCreate(Request $request): JsonResponse
 {
  $validated=Validator::make($request->all(),[
   'name'=>['required','string','max:120'],
   'email'=>['required','string','email','max:255'],
   'password'=>['required','string','min:10','max:255'],
   'roles'=>['required','array','min:1'],
   'roles.*'=>['required','string','distinct','max:80'],
  ])->validate();

  if(!$this->iam->rolesExist($validated['roles'])){
   return ProblemDetails::response($request,422,'Error de validación','Uno o más roles no existen.','https://fixphone.uy/problems/http-422','http_422',['errors'=>['roles'=>['Uno o más roles no existen.']]]);
  }

  $key=trim((string)$request->header('Idempotency-Key',''));
  if($key===''){
   return ProblemDetails::response($request,422,'Error de validación','Idempotency-Key es obligatorio.','https://fixphone.uy/problems/http-422','http_422',['errors'=>['Idempotency-Key'=>['El encabezado Idempotency-Key es obligatorio.']]]);
  }

  $hash=hash('sha256',json_encode([
   'name'=>trim($validated['name']),
   'email'=>mb_strtolower(trim($validated['email'])),
   'password'=>$validated['password'],
   'roles'=>array_values($validated['roles']),
  ],JSON_THROW_ON_ERROR));

  try{
   $result=$this->iam->createUser(
    $validated,$key,$hash,
    (string)$request->user()->getAuthIdentifier(),
    $request->attributes->get('correlation_id')
   );
  }catch(IdempotencyConflict){
   return ProblemDetails::response($request,409,'Conflicto de idempotencia','La clave de idempotencia ya fue usada con otra solicitud o sigue reservada.','https://fixphone.uy/problems/idempotency-conflict','idempotency_conflict');
  }

  if(($result['data']['duplicate_email']??false)===true){
   return ProblemDetails::response($request,422,'Error de validación','El correo electrónico ya está registrado.','https://fixphone.uy/problems/http-422','http_422',['errors'=>['email'=>['El correo electrónico ya está registrado.']]]);
  }

  return response()->json($result['data'],$result['status']);
 }

 public function usersUpdate(Request $request,string $userId): JsonResponse
 {
  $validated=Validator::make($request->all(),[
   'name'=>['sometimes','string','max:120'],
   'email'=>['sometimes','string','email','max:255',Rule::unique('users','email')->ignore($userId)],
   'password'=>['sometimes','string','min:10','max:255'],
  ])->validate();

  if($validated===[]){
   return ProblemDetails::response($request,422,'Error de validación','Debe indicar al menos un campo para actualizar.','https://fixphone.uy/problems/http-422','http_422');
  }

  $user=$this->iam->updateUser($userId,$validated,(string)$request->user()->getAuthIdentifier(),$request->attributes->get('correlation_id'));
  return $user!==null
   ? response()->json(['data'=>$user])
   : ProblemDetails::response($request,404,'Usuario no encontrado','El usuario solicitado no existe.','https://fixphone.uy/problems/user-not-found','user_not_found');
 }

 public function usersDeactivate(Request $request,string $userId): Response
 {
  if($userId===(string)$request->user()->getAuthIdentifier()){
   return ProblemDetails::response($request,409,'Operación no permitida','No puede desactivar su propia cuenta desde esta operación.','https://fixphone.uy/problems/self-deactivation-not-allowed','self_deactivation_not_allowed');
  }

  if(!$this->iam->deactivateUser($userId,(string)$request->user()->getAuthIdentifier(),$request->attributes->get('correlation_id'))){
   return ProblemDetails::response($request,404,'Usuario no encontrado','El usuario solicitado no existe.','https://fixphone.uy/problems/user-not-found','user_not_found');
  }

  return response()->noContent();
 }

 public function rolesList(): JsonResponse
 {
  return response()->json(['data'=>$this->iam->rolesList()]);
 }

 public function roleAssignmentsUpdate(Request $request,string $userId): JsonResponse
 {
  $validated=Validator::make($request->all(),[
   'roles'=>['required','array','min:1'],
   'roles.*'=>['required','string','distinct','max:80'],
  ])->validate();

  if(!$this->iam->rolesExist($validated['roles'])){
   return ProblemDetails::response($request,422,'Error de validación','Uno o más roles no existen.','https://fixphone.uy/problems/http-422','http_422',['errors'=>['roles'=>['Uno o más roles no existen.']]]);
  }

  $user=$this->iam->replaceRoles($userId,$validated['roles'],(string)$request->user()->getAuthIdentifier(),$request->attributes->get('correlation_id'));
  return $user!==null
   ? response()->json(['data'=>$user])
   : ProblemDetails::response($request,404,'Usuario no encontrado','El usuario solicitado no existe.','https://fixphone.uy/problems/user-not-found','user_not_found');
 }
}
