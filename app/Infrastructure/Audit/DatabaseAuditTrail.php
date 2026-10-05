<?php
namespace App\Infrastructure\Audit;
use App\Application\Shared\Contracts\AuditTrail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
final class DatabaseAuditTrail implements AuditTrail {
 public function record(string $eventType,string $action,string $entityType,string $entityId,?string $actorType,?string $actorId,?string $correlationId,array $metadata=[]): void {
  DB::table('audit_events')->insert(['id'=>(string)Str::ulid(),'event_type'=>$eventType,'action'=>$action,'entity_type'=>$entityType,'entity_id'=>$entityId,'actor_type'=>$actorType,'actor_id'=>$actorId,'correlation_id'=>$correlationId,'metadata'=>json_encode($metadata,JSON_THROW_ON_ERROR),'occurred_at'=>now()]);
 }
}
