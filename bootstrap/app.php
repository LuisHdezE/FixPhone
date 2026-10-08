<?php
use App\Presentation\Http\Middleware\CorrelationIdMiddleware;
use App\Presentation\Http\Middleware\RequirePermission;
use App\Presentation\Http\Support\ProblemDetails;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable as BaseThrowable;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(web: __DIR__.'/../routes/web.php', api: __DIR__.'/../routes/api.php', commands: __DIR__.'/../routes/console.php', health: '/up')
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(CorrelationIdMiddleware::class);
        $middleware->alias(['permission'=>RequirePermission::class]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(static fn (Request $request, BaseThrowable $e): bool => $request->is('api/*') || $request->expectsJson());
        $exceptions->render(function (BaseThrowable $exception, Request $request) {
            if (! $request->is('api/*')) return null;
            $status = match (true) {
                $exception instanceof AuthenticationException => 401,
                $exception instanceof AuthorizationException => 403,
                $exception instanceof ValidationException => 422,
                $exception instanceof HttpExceptionInterface => $exception->getStatusCode(),
                default => 500,
            };
            $title = match ($status) {
                401 => 'Autenticación requerida',
                403 => 'Acceso denegado',
                404 => 'Recurso no encontrado',
                405 => 'Método no permitido',
                409 => 'Conflicto',
                422 => 'Error de validación',
                429 => 'Demasiadas solicitudes',
                default => $status >= 500 ? 'Error interno del servidor' : 'Solicitud no válida',
            };
            $extensions = $exception instanceof ValidationException ? ['errors' => $exception->errors()] : [];
            return ProblemDetails::response($request, $status, $title, $title, "https://fixphone.uy/problems/http-$status", "http_$status", $extensions);
        });
    })->create();
