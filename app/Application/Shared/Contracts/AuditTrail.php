<?php
namespace App\Application\Shared\Contracts;
interface AuditTrail {
 public function record(string $eventType,string $action,string $entityType,string $entityId,?string $actorType,?string $actorId,?string $correlationId,array $metadata=[]): void;
}
