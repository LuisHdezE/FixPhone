<?php
namespace App\Providers;
use App\Application\Shared\Contracts\AuditTrail;
use App\Application\Shared\Contracts\IdempotencyStore;
use App\Infrastructure\Audit\DatabaseAuditTrail;
use App\Infrastructure\Idempotency\DatabaseIdempotencyStore;
use Illuminate\Support\ServiceProvider;
final class AppServiceProvider extends ServiceProvider {
 public function register(): void {
  $this->app->bind(AuditTrail::class,DatabaseAuditTrail::class);
  $this->app->bind(IdempotencyStore::class,DatabaseIdempotencyStore::class);
 }
 public function boot(): void {}
}
