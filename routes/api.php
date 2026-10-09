<?php
use App\Presentation\Http\Controllers\AuthLoginController;
use App\Presentation\Http\Controllers\AuthLogoutController;
use App\Presentation\Http\Controllers\AuthMeController;
use App\Presentation\Http\Controllers\IamController;
use App\Presentation\Http\Controllers\InventoryController;
use App\Presentation\Http\Controllers\MasterDataController;
use App\Presentation\Http\Controllers\DeviceValuationController;
use App\Presentation\Http\Controllers\RepairQuoteController;
use App\Presentation\Http\Controllers\MediaStorageSettingsController;
use App\Presentation\Http\Controllers\ValuationPhotosController;
use App\Presentation\Http\Controllers\PartsDonorStorefrontController;
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
 Route::get('/store/parts-donors', [PartsDonorStorefrontController::class, 'index'])->name('api.v1.store.parts-donors.index');
 Route::get('/store/parts-donors/{id}', [PartsDonorStorefrontController::class, 'show'])->name('api.v1.store.parts-donors.show');
 Route::get('/store/products',[InventoryController::class, 'showroomList'])->name('api.v1.store.products.index');
 Route::get('/admin/master-data',[MasterDataController::class, 'catalog'])->name('api.v1.admin.master-data.catalog');
 Route::get('/admin/master-data/{kind}',[MasterDataController::class, 'index'])->name('api.v1.admin.master-data.index');
 Route::post('/admin/master-data/{kind}',[MasterDataController::class, 'store'])->name('api.v1.admin.master-data.store');
 Route::patch('/admin/master-data/{kind}/{id}',[MasterDataController::class, 'update'])->name('api.v1.admin.master-data.update');
 Route::delete('/admin/master-data/{kind}/{id}',[MasterDataController::class, 'destroy'])->name('api.v1.admin.master-data.destroy');

 Route::middleware('auth:sanctum')->group(function (): void {
  Route::get('/admin/inventory',[InventoryController::class, 'devicesList'])->middleware('permission:inventory.view')->name('api.v1.admin.inventory.index');
  Route::post('/admin/inventory',[InventoryController::class, 'create'])->middleware('permission:devices.intake')->name('api.v1.admin.inventory.store');
  Route::prefix('admin/media/storage-profiles')->middleware('permission:integrations.manage')->group(function (): void {
   Route::get('/', [MediaStorageSettingsController::class, 'index'])->name('api.v1.admin.media.storage.index');
   Route::post('/', [MediaStorageSettingsController::class, 'store'])->name('api.v1.admin.media.storage.store');
   Route::patch('/{id}', [MediaStorageSettingsController::class, 'update'])->name('api.v1.admin.media.storage.update');
   Route::post('/{id}/select', [MediaStorageSettingsController::class, 'select'])->name('api.v1.admin.media.storage.select');
   Route::post('/{id}/test', [MediaStorageSettingsController::class, 'testConnection'])->middleware('throttle:6,1')->name('api.v1.admin.media.storage.test');
  });

  Route::post('/auth/logout',AuthLogoutController::class)->name('api.v1.auth.logout');
  Route::get('/auth/me',AuthMeController::class)->name('api.v1.auth.me');

  Route::prefix('admin/valuations')->middleware('permission:valuation.manage')->group(function (): void {
   Route::get('/',[DeviceValuationController::class,'index'])->name('api.v1.admin.valuations.index');
   Route::post('/',[DeviceValuationController::class,'store'])->name('api.v1.admin.valuations.store');
   Route::patch('/{id}',[DeviceValuationController::class,'update'])->name('api.v1.admin.valuations.update');
   Route::get('/{id}/photos',[ValuationPhotosController::class,'index'])->name('api.v1.admin.valuations.photos.index');
   Route::post('/{id}/photos/presign',[ValuationPhotosController::class,'presign'])->middleware('throttle:10,1')->name('api.v1.admin.valuations.photos.presign');
   Route::post('/{id}/photos/{photoId}/confirm',[ValuationPhotosController::class,'confirm'])->name('api.v1.admin.valuations.photos.confirm');
   Route::post('/{id}/photos/{photoId}/primary',[ValuationPhotosController::class,'primary'])->name('api.v1.admin.valuations.photos.primary');
  });

  Route::prefix('admin/repair-quotes')->middleware('permission:repair_quotes.manage')->group(function (): void {
   Route::get('/', [RepairQuoteController::class, 'index'])->name('api.v1.admin.repair-quotes.index');
   Route::post('/', [RepairQuoteController::class, 'store'])->name('api.v1.admin.repair-quotes.store');
  });

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
