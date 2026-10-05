<?php
namespace App\Presentation\Http\Middleware;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
final class CorrelationIdMiddleware {
 public function handle(Request $request, Closure $next): Response {
  $incoming=trim((string)$request->header('X-Correlation-ID',''));
  $id=preg_match('/^[A-Za-z0-9._:-]{1,100}$/',$incoming)===1?$incoming:(string)Str::uuid();
  $request->attributes->set('correlation_id',$id);
  $response=$next($request); $response->headers->set('X-Correlation-ID',$id); return $response;
 }
}
