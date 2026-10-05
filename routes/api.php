<?php
use App\Presentation\Http\Controllers\AuthLoginController;
use App\Presentation\Http\Controllers\AuthLogoutController;
use App\Presentation\Http\Controllers\AuthMeController;
use App\Presentation\Http\Controllers\IamController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
 Route::post('/auth/login',AuthLoginController::class)->name('api.v1.auth.login');

 Route::middleware('auth:sanctum')->group(function (): void {
  Route::post('/auth/logout',AuthLogoutController::class)->name('api.v1.auth.logout');
  Route::get('/auth/me',AuthMeController::class)->name('api.v1.auth.me');

  Route::prefix('admin')->middleware('permission:users.manage')->group(function (): void {
   Route::get('/users',[IamController::class,'usersList'])->name('api.v1.admin.users.index');
   Route::get('/users/{userId}',[IamController::class,'usersShow'])->name('api.v1.admin.users.show');
   Route::post('/users',[IamController::class,'usersCreate'])->name('api.v1.admin.users.store');
   Route::patch('/users/{userId}',[IamController::class,'usersUpdate'])->name('api.v1.admin.users.update');
   Route::post('/users/{userId}/deactivate',[IamController::class,'usersDeactivate'])->name('api.v1.admin.users.deactivate');
   Route::get('/roles',[IamController::class,'rolesList'])->name('api.v1.admin.roles.index');
   Route::put('/users/{userId}/roles',[IamController::class,'roleAssignmentsUpdate'])->name('api.v1.admin.users.roles.update');
  });
 });
});
