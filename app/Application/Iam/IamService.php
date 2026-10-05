<?php
namespace App\Application\Iam;

use App\Application\Iam\Contracts\IamRepository;
use App\Application\Iam\Exceptions\IdempotencyConflict;
use App\Application\Shared\Contracts\AuditTrail;
use App\Application\Shared\Contracts\IdempotencyStore;

final readonly class IamService
{
 public function __construct(
  private IamRepository $repository,
  private AuditTrail $audit,
  private IdempotencyStore $idempotency,
 ) {}

 public function usersList(): array { return $this->repository->listUsers(); }
 public function userShow(string $userId): ?array { return $this->repository->findUser($userId); }
 public function rolesList(): array { return $this->repository->listRoles(); }

 public function createUser(array $data,string $key,string $requestHash,string $actorId,?string $correlationId): array
 {
  $existing=$this->idempotency->get('usersCreate',$key);
  if($existing!==null){
   if(($existing['request_hash']??null)!==$requestHash) throw new IdempotencyConflict('Idempotency key reused with a different request.');
   if(($existing['state']??null)==='completed'){
    return ['status'=>(int)$existing['response_status'],'data'=>json_decode((string)$existing['response_body'],true,512,JSON_THROW_ON_ERROR),'replayed'=>true];
   }
   throw new IdempotencyConflict('Request with this idempotency key is still reserved.');
  }

  if($this->repository->emailExists($data['email'])) return ['status'=>422,'data'=>['duplicate_email'=>true],'replayed'=>false];

  if(!$this->idempotency->reserve('usersCreate',$key,$requestHash)) throw new IdempotencyConflict('Unable to reserve idempotency key.');

  $user=$this->repository->createUser($data['name'],$data['email'],$data['password'],$data['roles']);
  $payload=['data'=>$user];
  $this->idempotency->complete('usersCreate',$key,201,$payload);
  $this->audit->record('ACCESS.USER_CREATED','create','user',(string)$user['id'],'user',$actorId,$correlationId,['roles'=>$user['roles']]);

  return ['status'=>201,'data'=>$payload,'replayed'=>false];
 }

 public function updateUser(string $userId,array $changes,string $actorId,?string $correlationId): ?array
 {
  $user=$this->repository->updateUser($userId,$changes);
  if($user!==null){
   $this->audit->record('ACCESS.USER_UPDATED','update','user',$userId,'user',$actorId,$correlationId,['fields'=>array_values(array_keys($changes))]);
  }
  return $user;
 }

 public function deactivateUser(string $userId,string $actorId,?string $correlationId): bool
 {
  $ok=$this->repository->deactivateUser($userId);
  if($ok){
   $this->audit->record('ACCESS.USER_DEACTIVATED','deactivate','user',$userId,'user',$actorId,$correlationId);
  }
  return $ok;
 }

 public function replaceRoles(string $userId,array $roles,string $actorId,?string $correlationId): ?array
 {
  $before=$this->repository->findUser($userId);
  if($before===null) return null;
  $after=$this->repository->replaceRoles($userId,$roles);
  $this->audit->record('ACCESS.ROLE_CHANGED','replace_roles','user',$userId,'user',$actorId,$correlationId,[
   'before'=>$before['roles'],
   'after'=>$after['roles'],
  ]);
  $this->audit->record('ACCESS.PERMISSION_CHANGED','effective_permissions_changed','user',$userId,'user',$actorId,$correlationId,[
   'before'=>$before['permissions'],
   'after'=>$after['permissions'],
  ]);
  return $after;
 }

 public function rolesExist(array $roles): bool { return $this->repository->rolesExist($roles); }
}
