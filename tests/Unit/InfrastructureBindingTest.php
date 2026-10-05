<?php

namespace Tests\Unit;

use App\Application\Shared\Contracts\AuditTrail;
use App\Application\Shared\Contracts\IdempotencyStore;
use App\Infrastructure\Audit\DatabaseAuditTrail;
use App\Infrastructure\Idempotency\DatabaseIdempotencyStore;
use Tests\TestCase;

final class InfrastructureBindingTest extends TestCase
{
    public function test_cross_cutting_ports_resolve_to_durable_database_adapters(): void
    {
        $this->assertInstanceOf(DatabaseAuditTrail::class, $this->app->make(AuditTrail::class));
        $this->assertInstanceOf(DatabaseIdempotencyStore::class, $this->app->make(IdempotencyStore::class));
    }
}
