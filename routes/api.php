<?php
use App\Presentation\Http\Controllers\AuthLoginController;
use App\Presentation\Http\Controllers\AuthLogoutController;
use App\Presentation\Http\Controllers\AuthMeController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
 Route::post('/auth/login',AuthLoginController::class)->name('api.v1.auth.login');

 Route::middleware('auth:sanctum')->group(function (): void {
  Route::post('/auth/logout',AuthLogoutController::class)->name('api.v1.auth.logout');
  Route::get('/auth/me',AuthMeController::class)->name('api.v1.auth.me');
 });
});
