<?php
use App\Presentation\Http\Controllers\AuthLoginController;
use App\Presentation\Http\Controllers\AuthLogoutController;
use App\Presentation\Http\Controllers\AuthMeController;
use App\Presentation\Http\Controllers\IamController;
use App\Presentation\Http\Controllers\InventoryController;
use App\Presentation\Http\Controllers\MasterDataController;
use Illuminate\Support\Facades\Route;

Route::post('/_deploy/run-migrations', function (\Illuminate\Http\Request $request) {
    $token = env('DEPLOY_TOKEN');
    if (!$token || $request->header('X-Deploy-Token') !== $token) {
        abort(401, 'Unauthorized');
    }
    \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
    return response()->json(['message' => 'Migrations run successfully.']);
});

Route::prefix('v1')->group(function (): void {
 Route::post('/auth/login',AuthLoginController::class)->name('api.v1.auth.login');
 Route::get('/store/products',[InventoryController::class, 'showroomList'])->name('api.v1.store.products.index');
 Route::get('/admin/inventory',[InventoryController::class, 'devicesList'])->name('api.v1.admin.inventory.index');
 Route::post('/admin/inventory',[InventoryController::class, 'create'])->name('api.v1.admin.inventory.store');
 Route::get('/admin/master-data',[MasterDataController::class, 'catalog'])->name('api.v1.admin.master-data.catalog');
 Route::get('/admin/master-data/{kind}',[MasterDataController::class, 'index'])->name('api.v1.admin.master-data.index');
 Route::post('/admin/master-data/{kind}',[MasterDataController::class, 'store'])->name('api.v1.admin.master-data.store');
 Route::patch('/admin/master-data/{kind}/{id}',[MasterDataController::class, 'update'])->name('api.v1.admin.master-data.update');
 Route::delete('/admin/master-data/{kind}/{id}',[MasterDataController::class, 'destroy'])->name('api.v1.admin.master-data.destroy');

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
