<?php
namespace App\Presentation\Http\Middleware;

use App\Application\Authorization\Contracts\AuthorizationGateway;
use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final readonly class RequirePermission
{
 public function __construct(private AuthorizationGateway $authorization) {}

 public function handle(Request $request,Closure $next,string $permission): Response
 {
  $user=$request->user();
  if($user===null || !$this->authorization->hasPermission((string)$user->getAuthIdentifier(),$permission)){
   throw new AuthorizationException('Permission denied.');
  }
  return $next($request);
 }
}
