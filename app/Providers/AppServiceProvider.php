<?php
namespace App\Providers;

use App\Application\Authentication\Contracts\AuthenticationGateway;
use App\Application\Authentication\Contracts\PrincipalGateway;
use App\Application\Authentication\Contracts\TokenRevocationGateway;
use App\Application\Authorization\Contracts\AuthorizationGateway;
use App\Application\Iam\Contracts\IamRepository;
use App\Application\Shared\Contracts\AuditTrail;
use App\Application\Shared\Contracts\IdempotencyStore;
use App\Infrastructure\Audit\DatabaseAuditTrail;
use App\Infrastructure\Authentication\DatabasePrincipalGateway;
use App\Infrastructure\Authentication\SanctumAuthenticationGateway;
use App\Infrastructure\Authentication\SanctumTokenRevocationGateway;
use App\Infrastructure\Authorization\DatabaseAuthorizationGateway;
use App\Infrastructure\Iam\DatabaseIamRepository;
use App\Infrastructure\Idempotency\DatabaseIdempotencyStore;
use Illuminate\Support\ServiceProvider;

final class AppServiceProvider extends ServiceProvider
{
 public function register(): void
 {
  $this->app->bind(AuditTrail::class,DatabaseAuditTrail::class);
  $this->app->bind(IdempotencyStore::class,DatabaseIdempotencyStore::class);
  $this->app->bind(AuthenticationGateway::class,SanctumAuthenticationGateway::class);
  $this->app->bind(PrincipalGateway::class,DatabasePrincipalGateway::class);
  $this->app->bind(TokenRevocationGateway::class,SanctumTokenRevocationGateway::class);
  $this->app->bind(AuthorizationGateway::class,DatabaseAuthorizationGateway::class);
  $this->app->bind(IamRepository::class,DatabaseIamRepository::class);
 }

 public function boot(): void {}
}
