<?php
use App\Presentation\Http\Controllers\AuthLoginController;
use App\Presentation\Http\Controllers\AuthLogoutController;
use App\Presentation\Http\Controllers\AuthMeController;
use App\Presentation\Http\Controllers\IamController;
use App\Presentation\Http\Controllers\InventoryController;
use App\Presentation\Http\Controllers\OperationalInventoryController;
use App\Presentation\Http\Controllers\SparePartsInventoryController;
use App\Presentation\Http\Controllers\DeviceInventoryCrudController;
use App\Presentation\Http\Controllers\OperationalDashboardController;
use App\Presentation\Http\Controllers\DeviceDismantlingController;
use App\Presentation\Http\Controllers\DeviceRoutingController;
use App\Presentation\Http\Controllers\DeviceLifecycleController;
use App\Presentation\Http\Controllers\MasterDataController;
use App\Presentation\Http\Controllers\DeviceModelSpecificationsController;
use App\Presentation\Http\Controllers\DeviceValuationController;
use App\Presentation\Http\Controllers\RepairQuoteController;
use App\Presentation\Http\Controllers\DeviceInstalledPartsController;
use App\Presentation\Http\Controllers\DeviceSalesController;
use App\Presentation\Http\Controllers\DeviceTechnicalEvaluationController;
use App\Presentation\Http\Controllers\FinancialReportsController;
use App\Presentation\Http\Controllers\MediaStorageSettingsController;
use App\Presentation\Http\Controllers\ValuationPhotosController;
use App\Presentation\Http\Controllers\PartsDonorStorefrontController;
use App\Presentation\Http\Controllers\ConsignorsController;
use App\Presentation\Http\Controllers\CustomerDirectoryController;
use App\Presentation\Http\Controllers\CommercialOrdersController;
use App\Presentation\Http\Controllers\AiPromptCatalogController;
use App\Presentation\Http\Controllers\ReferencePriceImportController;
use App\Presentation\Http\Controllers\ReferencePriceComparisonController;
use App\Presentation\Http\Controllers\StorefrontCampaignController;
use App\Presentation\Http\Controllers\Storefront\StorefrontCheckoutController;
use App\Presentation\Http\Controllers\InventoryItemPhotosController;
use App\Presentation\Http\Controllers\InventoryItemPromotionalAssetsController;
use Illuminate\Support\Facades\Route;

Route::post('/_deploy/run-migrations', function (\Illuminate\Http\Request $request) {
    $token = env('DEPLOY_TOKEN');
    if (!$token || !hash_equals($token, (string) $request->header('X-Deploy-Token'))) {
        abort(401, 'Unauthorized');
    }

    $stage = 'migrations';
    try {
        $migrationStatus = \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
        if ($migrationStatus !== 0) {
            \Illuminate\Support\Facades\Log::error('Post-deploy migrations failed', [
                'stage' => 'migrations',
                'exit_code' => $migrationStatus,
                'output' => \Illuminate\Support\Str::limit(\Illuminate\Support\Facades\Artisan::output(), 1000),
            ]);
            return response()->json([
                'status' => 'error',
                'stage' => 'migrations',
                'message' => 'Migrations execution failed.',
                'code' => 'migration_failed',
            ], 500);
        }

        $stage = 'ai_prompt_catalog_seed';
        $seedStatus = \Illuminate\Support\Facades\Artisan::call('db:seed', [
            '--class' => \Database\Seeders\AiPromptCatalogSeeder::class,
            '--force' => true,
        ]);
        if ($seedStatus !== 0) {
            \Illuminate\Support\Facades\Log::error('Post-deploy AI prompt catalog seed failed', [
                'stage' => 'ai_prompt_catalog_seed',
                'exit_code' => $seedStatus,
                'output' => \Illuminate\Support\Str::limit(\Illuminate\Support\Facades\Artisan::output(), 1000),
            ]);
            return response()->json([
                'status' => 'error',
                'stage' => 'ai_prompt_catalog_seed',
                'message' => 'AI prompt catalog seed failed.',
                'code' => 'seed_failed',
            ], 500);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Migrations and AI prompt catalog seed completed.',
        ]);
    } catch (\Throwable $e) {
        $sanitizedMessage = (string) preg_replace('/(password|pwd|token|secret|key)=[^\s;&]+/i', '$1=***', $e->getMessage());
        $sanitizedMessage = (string) preg_replace('/:[^:@\s]+@/i', ':***@', $sanitizedMessage);

        \Illuminate\Support\Facades\Log::error('Post-deploy execution exception', [
            'stage' => $stage,
            'exception' => get_class($e),
            'message' => $sanitizedMessage,
            'code' => $e->getCode(),
        ]);

        return response()->json([
            'status' => 'error',
            'stage' => $stage,
            'message' => 'Post-deploy execution encountered an error during ' . $stage . '.',
            'code' => 'post_deploy_error',
            'error_summary' => \Illuminate\Support\Str::limit($sanitizedMessage, 200),
        ], 500);
    }
});

Route::post('/_deploy/mvp-action', function (\Illuminate\Http\Request $request) {
    if (config('app.mvp_seeder_enabled') !== true) {
        return response()->json(['message' => 'MVP endpoints are currently disabled.'], 403);
    }

    $deployToken = env('DEPLOY_TOKEN');
    $mvpToken = env('MVP_TOKEN'); // Separate token for data alteration
    
    $action = $request->input('action');
    if (!in_array($action, ['status', 'backup', 'seed', 'rollback'])) {
        return response()->json(['error' => 'Invalid action'], 400);
    }

    // Status can be done with DEPLOY_TOKEN, others require MVP_TOKEN
    $token = $request->header('X-Deploy-Token');
    if ($action === 'status') {
        if (!$deployToken || !hash_equals($deployToken, (string) $token)) return response()->json(['message' => 'Unauthorized'], 401);
    } else {
        if (!$mvpToken || !hash_equals($mvpToken, (string) $token)) return response()->json(['message' => 'Unauthorized for data alteration'], 401);
    }
    
    $exitCode = \Illuminate\Support\Facades\Artisan::call('fixphone:seed-mvp', ['--'.$action => true, '--force' => true]);
    
    if ($exitCode !== 0) {
        return response()->json([
            'error' => 'Command failed',
            'output' => \Illuminate\Support\Facades\Artisan::output()
        ], 500);
    }

    return response()->json([
        'message' => 'Action executed',
        'output' => \Illuminate\Support\Facades\Artisan::output()
    ]);
});


Route::post('/_deploy/device-production-reset', function (\Illuminate\Http\Request $request) {
    $token = env('DEPLOY_TOKEN');
    if (!$token || !hash_equals($token, (string) $request->header('X-Deploy-Token'))) {
        abort(401);
    }
    $input = $request->validate([
        'mode' => 'required|in:preview,execute',
        'fingerprint' => 'nullable|string|size:64',
        'confirmation' => 'nullable|string|max:100',
    ]);
    try {
        $result = app(\App\Infrastructure\Maintenance\DeviceProductionReset::class)->run(
            $input['mode'] === 'execute',
            $input['fingerprint'] ?? '',
            $input['confirmation'] ?? '',
        );
        return response()->json($result)->header('Cache-Control', 'no-store');
    } catch (\RuntimeException $exception) {
        return response()->json(['message' => $exception->getMessage()], 409);
    }
})->middleware('throttle:3,1');

Route::post('/_deploy/spare-parts-production-reset', function (\Illuminate\Http\Request $request) {
    $token = env('DEPLOY_TOKEN');
    if (!$token || !hash_equals($token, (string) $request->header('X-Deploy-Token'))) {
        abort(401);
    }
    $input = $request->validate([
        'mode' => 'required|in:preview,execute',
        'fingerprint' => 'nullable|string|size:64',
        'confirmation' => 'nullable|string|max:100',
    ]);
    try {
        $result = app(\App\Infrastructure\Maintenance\SparePartsProductionReset::class)->run(
            $input['mode'] === 'execute',
            $input['fingerprint'] ?? '',
            $input['confirmation'] ?? '',
        );
        return response()->json($result)->header('Cache-Control', 'no-store');
    } catch (\RuntimeException $exception) {
        return response()->json(['message' => $exception->getMessage()], 409);
    }
})->middleware('throttle:3,1');

Route::prefix('v1')->group(function (): void {
 Route::post('/auth/login',AuthLoginController::class)->middleware('throttle:10,1')->name('api.v1.auth.login');
 Route::post('/store/register', \App\Presentation\Http\Controllers\StorefrontRegistrationController::class)->middleware('throttle:5,1');
 Route::get('/store/parts-donors', [PartsDonorStorefrontController::class, 'index'])->name('api.v1.store.parts-donors.index');
 Route::get('/store/parts-donors/{id}', [PartsDonorStorefrontController::class, 'show'])->name('api.v1.store.parts-donors.show');
 Route::get('/store/campaigns', [StorefrontCampaignController::class, 'index']);
 Route::get('/store/products',[InventoryController::class, 'showroomList'])->name('api.v1.store.products.index');
 Route::get('/admin/master-data',[MasterDataController::class, 'catalog'])->name('api.v1.admin.master-data.catalog');
 Route::get('/admin/master-data/{kind}',[MasterDataController::class, 'index'])->name('api.v1.admin.master-data.index');
 Route::post('/admin/master-data/{kind}',[MasterDataController::class, 'store'])->middleware(['auth:sanctum', 'permission:catalog.manage'])->name('api.v1.admin.master-data.store');
 Route::patch('/admin/master-data/{kind}/{id}',[MasterDataController::class, 'update'])->middleware(['auth:sanctum', 'permission:catalog.manage'])->name('api.v1.admin.master-data.update');
 Route::delete('/admin/master-data/{kind}/{id}',[MasterDataController::class, 'destroy'])->middleware(['auth:sanctum', 'permission:catalog.manage'])->name('api.v1.admin.master-data.destroy');

 Route::middleware('auth:sanctum')->group(function (): void {
  Route::get('/store/cart', [\App\Presentation\Http\Controllers\StorefrontCartController::class, 'index']);
  Route::post('/store/cart', [\App\Presentation\Http\Controllers\StorefrontCartController::class, 'add']);
  Route::patch('/store/cart/{product}', [\App\Presentation\Http\Controllers\StorefrontCartController::class, 'update']);
  Route::delete('/store/cart/{product}', [\App\Presentation\Http\Controllers\StorefrontCartController::class, 'remove']);
  Route::post('/store/checkout', [StorefrontCheckoutController::class, 'store'])->middleware('throttle:10,1');
  Route::get('/admin/device-models/{modelId}/technical', [DeviceModelSpecificationsController::class, 'show'])->middleware('permission:catalog.manage');
  Route::put('/admin/device-models/{modelId}/technical', [DeviceModelSpecificationsController::class, 'saveSpecs'])->middleware('permission:catalog.manage');
  Route::post('/admin/device-models/{modelId}/variants', [DeviceModelSpecificationsController::class, 'storeVariant'])->middleware('permission:catalog.manage');
  Route::put('/admin/device-models/{modelId}/variants/{variantId}', [DeviceModelSpecificationsController::class, 'updateVariant'])->middleware('permission:catalog.manage');
  Route::get('/admin/device-models/{modelId}/resolved-specs', [\App\Presentation\Http\Controllers\DeviceSpecificationsReadController::class, 'forModel'])->middleware('permission:inventory.view');
  Route::get('/admin/inventory/{id}/specifications', [\App\Presentation\Http\Controllers\DeviceSpecificationsReadController::class, 'forDevice'])->middleware('permission:inventory.view');
  Route::get('/admin/dashboard/operational',[OperationalDashboardController::class, 'show'])->middleware('permission:inventory.view')->name('api.v1.admin.dashboard.operational.show');
  Route::get('/admin/inventory',[InventoryController::class, 'devicesList'])->middleware('permission:inventory.view')->name('api.v1.admin.inventory.index');
  Route::apiResource('admin/consignors', ConsignorsController::class)->except(['destroy'])->middleware('permission:catalog.manage');
  // CRM directory: authenticated reads and catalog-maintenance writes.
  Route::get('/admin/customers', [CustomerDirectoryController::class, 'index'])->middleware('permission:inventory.view')->name('api.v1.admin.customers.index');
  Route::get('/admin/customers/{id}', [CustomerDirectoryController::class, 'show'])->middleware('permission:inventory.view')->name('api.v1.admin.customers.show');
  Route::post('/admin/customers', [CustomerDirectoryController::class, 'store'])->middleware('permission:catalog.manage')->name('api.v1.admin.customers.store');
  Route::patch('/admin/customers/{id}', [CustomerDirectoryController::class, 'update'])->middleware('permission:catalog.manage')->name('api.v1.admin.customers.update');
  Route::delete('/admin/customers/{id}', [CustomerDirectoryController::class, 'destroy'])->middleware('permission:catalog.manage')->name('api.v1.admin.customers.destroy');
  Route::get('/admin/orders', [CommercialOrdersController::class, 'index'])->middleware('permission:orders.view')->name('api.v1.admin.orders.index');
  Route::get('/admin/orders/catalog', [CommercialOrdersController::class, 'catalog'])->middleware('permission:orders.view')->name('api.v1.admin.orders.catalog');
  Route::get('/admin/orders/{id}', [CommercialOrdersController::class, 'show'])->middleware('permission:orders.view')->name('api.v1.admin.orders.show');
  Route::post('/admin/orders', [CommercialOrdersController::class, 'store'])->middleware('permission:orders.manage')->name('api.v1.admin.orders.store');
  Route::patch('/admin/orders/{id}', [CommercialOrdersController::class, 'update'])->middleware('permission:orders.manage')->name('api.v1.admin.orders.update');
  Route::patch('/admin/orders/{id}/status', [CommercialOrdersController::class, 'changeStatus'])->middleware('permission:orders.manage')->name('api.v1.admin.orders.status');
  
  // Operational inventory: one persisted source, separate permissions per action.
  Route::post('/admin/inventory/spare-parts',[SparePartsInventoryController::class, 'store'])->middleware('permission:catalog.manage')->name('api.v1.admin.inventory.spare-parts.store');
  Route::get('/admin/inventory/items',[OperationalInventoryController::class, 'index'])->middleware('permission:inventory.view')->name('api.v1.admin.inventory.items.index');
  Route::get('/admin/inventory/items/{id}',[OperationalInventoryController::class, 'show'])->middleware('permission:inventory.view')->name('api.v1.admin.inventory.items.show');
  Route::get('/admin/inventory/{id}/photos',[InventoryItemPhotosController::class,'index'])->middleware('permission:inventory.view');
  Route::post('/admin/inventory/{id}/photos/presign',[InventoryItemPhotosController::class,'presign'])->middleware(['permission:catalog.manage','throttle:20,1']);
  Route::post('/admin/inventory/{id}/photos/{photoId}/confirm',[InventoryItemPhotosController::class,'confirm'])->middleware(['permission:catalog.manage','throttle:20,1']);
  Route::post('/admin/inventory/{id}/photos/{photoId}/primary',[InventoryItemPhotosController::class,'primary'])->middleware('permission:catalog.manage');
  Route::put('/admin/inventory/{id}/photos/order',[InventoryItemPhotosController::class,'order'])->middleware('permission:catalog.manage');
  Route::delete('/admin/inventory/{id}/photos/{photoId}',[InventoryItemPhotosController::class,'destroy'])->middleware('permission:catalog.manage');
  Route::get('/admin/inventory/{id}/promotional-assets', [InventoryItemPromotionalAssetsController::class, 'index'])->middleware('permission:inventory.view');
  Route::delete('/admin/inventory/{id}/promotional-assets/prepared-empty', [InventoryItemPromotionalAssetsController::class, 'destroyEmptyPrepared'])->middleware('permission:catalog.manage');
  Route::post('/admin/inventory/{id}/promotional-assets/prepare', [InventoryItemPromotionalAssetsController::class, 'prepare'])->middleware('permission:catalog.manage');
  Route::post('/admin/inventory/{id}/promotional-assets/{assetId}/presign', [InventoryItemPromotionalAssetsController::class, 'presign'])->middleware(['permission:catalog.manage', 'throttle:20,1']);
  Route::post('/admin/inventory/{id}/promotional-assets/{assetId}/confirm', [InventoryItemPromotionalAssetsController::class, 'confirm'])->middleware(['permission:catalog.manage', 'throttle:20,1']);
  Route::post('/admin/inventory/{id}/promotional-assets/{assetId}/approve', [InventoryItemPromotionalAssetsController::class, 'approve'])->middleware('permission:catalog.manage');
  Route::post('/admin/inventory/{id}/promotional-assets/{assetId}/discard', [InventoryItemPromotionalAssetsController::class, 'discard'])->middleware('permission:catalog.manage');
  Route::delete('/admin/inventory/{id}/promotional-assets/{assetId}', [InventoryItemPromotionalAssetsController::class, 'discard'])->middleware('permission:catalog.manage');
  Route::patch('/admin/inventory/items/{id}',[OperationalInventoryController::class, 'update'])->middleware('permission:catalog.manage')->name('api.v1.admin.inventory.items.update');
  Route::get('/admin/inventory/items/{id}/adjustments',[OperationalInventoryController::class, 'adjustments'])->middleware('permission:inventory.view')->name('api.v1.admin.inventory.items.adjustments.index');
  Route::post('/admin/inventory/items/{id}/adjustments',[OperationalInventoryController::class, 'adjust'])->middleware('permission:inventory.adjust')->name('api.v1.admin.inventory.items.adjustments.store');

  Route::get('/admin/devices/{id}/components', [\App\Presentation\Http\Controllers\DeviceComponentExtractionController::class, 'options'])->middleware('permission:inventory.view');
  Route::post('/admin/devices/{id}/components', [\App\Presentation\Http\Controllers\DeviceComponentExtractionController::class, 'store'])->middleware(['permission:workshop.dismantle', 'permission:inventory.adjust']);
  Route::get('/admin/inventory/phones/{id}/publication', [\App\Presentation\Http\Controllers\PhonePublicationController::class, 'show'])->middleware('permission:catalog.manage');
  Route::patch('/admin/inventory/phones/{id}/publication', [\App\Presentation\Http\Controllers\PhonePublicationController::class, 'update'])->middleware('permission:catalog.manage');
  Route::get('/admin/inventory/spare-parts/{id}/compatibilities', [\App\Presentation\Http\Controllers\SparePartCompatibilityController::class, 'show'])->middleware('permission:catalog.manage');
  Route::put('/admin/inventory/spare-parts/{id}/compatibilities', [\App\Presentation\Http\Controllers\SparePartCompatibilityController::class, 'update'])->middleware('permission:catalog.manage');
  Route::get('/admin/inventory/spare-parts/{id}/publication', [\App\Presentation\Http\Controllers\SparePartPublicationController::class, 'show'])->middleware('permission:catalog.manage');
  Route::patch('/admin/inventory/spare-parts/{id}/publication', [\App\Presentation\Http\Controllers\SparePartPublicationController::class, 'update'])->middleware('permission:catalog.manage');

  Route::post('/admin/devices/{id}/commercial-preview', \App\Presentation\Http\Controllers\DeviceCommercialPreviewController::class)->middleware(['permission:inventory.view', 'throttle:20,1'])->name('api.v1.admin.devices.commercial-preview');
  Route::get('/admin/devices/{id}/technical-evaluations', [DeviceTechnicalEvaluationController::class, 'index'])->middleware('permission:inventory.view')->name('api.v1.admin.devices.technical-evaluations.index');
  Route::post('/admin/devices/{id}/technical-evaluations', [DeviceTechnicalEvaluationController::class, 'store'])->middleware('permission:diagnosis.manage')->name('api.v1.admin.devices.technical-evaluations.store');

  Route::get('/admin/devices/{id}/part-compatibility-diagnostics', [\App\Presentation\Http\Controllers\DevicePartCompatibilityDiagnosticController::class, 'index'])->middleware('permission:inventory.view');
  Route::get('/admin/devices/{id}/compatible-parts', [DeviceInstalledPartsController::class, 'compatibleParts'])->middleware('permission:inventory.view');
  Route::get('/admin/devices/{id}/installed-parts', [DeviceInstalledPartsController::class, 'index'])->middleware('permission:inventory.view')->name('api.v1.admin.devices.installed-parts.index');
  Route::post('/admin/devices/{id}/installed-parts', [DeviceInstalledPartsController::class, 'store'])->middleware('permission:inventory.adjust')->name('api.v1.admin.devices.installed-parts.store');
  Route::post('/admin/devices/{id}/installed-parts/{partId}/void', [DeviceInstalledPartsController::class, 'void'])->middleware('permission:inventory.adjust')->name('api.v1.admin.devices.installed-parts.void');

  Route::get('/admin/devices/{id}/sales', [DeviceSalesController::class, 'index'])->middleware('permission:inventory.view')->name('api.v1.admin.devices.sales.index');
  Route::post('/admin/devices/{id}/sell', [DeviceSalesController::class, 'store'])->middleware('permission:inventory.adjust')->name('api.v1.admin.devices.sell');
  Route::post('/admin/devices/{id}/sales/{saleId}/void', [DeviceSalesController::class, 'void'])->middleware('permission:inventory.adjust')->name('api.v1.admin.devices.sales.void');

  Route::get('/admin/reports/installed-parts-expenses', [FinancialReportsController::class, 'installedPartsExpenses'])->middleware('permission:inventory.view')->name('api.v1.admin.reports.installed-parts-expenses');
  Route::get('/admin/reports/direct-sales-settlements', [FinancialReportsController::class, 'directSalesSettlements'])->middleware('permission:inventory.view')->name('api.v1.admin.reports.direct-sales-settlements');
  Route::get('/admin/reports/consigned-phones-sold', [FinancialReportsController::class, 'consignedPhonesSold'])->middleware('permission:inventory.view')->name('api.v1.admin.reports.consigned-phones-sold');

  Route::post('/admin/inventory',[InventoryController::class, 'create'])->middleware('permission:devices.intake')->name('api.v1.admin.inventory.store');
  Route::patch('/admin/inventory/{id}',[DeviceInventoryCrudController::class, 'update'])->middleware('permission:catalog.manage')->name('api.v1.admin.inventory.device.update');
  Route::delete('/admin/inventory/{id}',[DeviceInventoryCrudController::class, 'destroy'])->middleware('permission:catalog.manage')->name('api.v1.admin.inventory.device.destroy');
  Route::patch('/admin/inventory/{id}/dismantling',[DeviceDismantlingController::class, 'update'])->middleware('permission:workshop.dismantle')->name('api.v1.admin.inventory.dismantling.update');
  Route::get('/admin/inventory/{id}/lifecycle', [DeviceLifecycleController::class, 'show'])->middleware('permission:inventory.view');
  Route::patch('/admin/inventory/{id}/lifecycle', [DeviceLifecycleController::class, 'update'])->middleware('permission:inventory.adjust');
  Route::patch('/admin/inventory/{id}/routing',[DeviceRoutingController::class, 'update'])->middleware('permission:routing.manage')->name('api.v1.admin.inventory.device.routing.update');
  Route::get('/admin/store/campaigns', [StorefrontCampaignController::class, 'index'])->middleware('permission:catalog.manage');
  Route::put('/admin/store/campaigns', [StorefrontCampaignController::class, 'update'])->middleware('permission:catalog.manage');
  Route::post('/admin/store/campaigns/images', \App\Presentation\Http\Controllers\StorefrontCampaignImageController::class)->middleware(['permission:catalog.manage', 'throttle:10,1']);
  Route::post('/admin/store/products/images', \App\Presentation\Http\Controllers\StorefrontProductImageController::class)->middleware(['permission:catalog.manage', 'throttle:10,1']);
  Route::post('/admin/store/models/images', \App\Presentation\Http\Controllers\DeviceModelImageController::class)->middleware(['permission:catalog.manage', 'throttle:10,1']);
  Route::post('/admin/store/images/presign', \App\Presentation\Http\Controllers\StorefrontImagePresignController::class)->middleware(['permission:catalog.manage', 'throttle:10,1']);
  Route::prefix('admin/media/storage-profiles')->middleware('permission:integrations.manage')->group(function (): void {
   Route::get('/', [MediaStorageSettingsController::class, 'index'])->name('api.v1.admin.media.storage.index');
   Route::post('/', [MediaStorageSettingsController::class, 'store'])->name('api.v1.admin.media.storage.store');
   Route::patch('/{id}', [MediaStorageSettingsController::class, 'update'])->name('api.v1.admin.media.storage.update');
   Route::post('/{id}/select', [MediaStorageSettingsController::class, 'select'])->name('api.v1.admin.media.storage.select');
   Route::post('/{id}/test', [MediaStorageSettingsController::class, 'testConnection'])->middleware('throttle:6,1')->name('api.v1.admin.media.storage.test');
  });

  Route::prefix('admin/reference-prices')->middleware('permission:reference_prices.import')->group(function (): void {
   Route::get('/comparison/options', [ReferencePriceComparisonController::class, 'options'])->name('api.v1.admin.reference-prices.compare.options');
   Route::get('/comparison', [ReferencePriceComparisonController::class, 'index'])->name('api.v1.admin.reference-prices.compare');
   Route::post('/own-prices', [ReferencePriceComparisonController::class, 'store'])->name('api.v1.admin.reference-prices.own-prices.store');
   Route::patch('/own-prices/{id}', [ReferencePriceComparisonController::class, 'update'])->name('api.v1.admin.reference-prices.own-prices.update');
   Route::delete('/own-prices/{id}', [ReferencePriceComparisonController::class, 'destroy'])->name('api.v1.admin.reference-prices.own-prices.destroy');
  });

  Route::prefix('admin/reference-prices/imports')->middleware(['permission:reference_prices.import', 'throttle:20,1'])->group(function (): void {
   Route::get('/', [ReferencePriceImportController::class, 'index'])->name('api.v1.admin.reference-prices.imports.index');
   Route::get('/{batchId}', [ReferencePriceImportController::class, 'show'])->name('api.v1.admin.reference-prices.imports.show');
   Route::post('/preview', [ReferencePriceImportController::class, 'preview'])->name('api.v1.admin.reference-prices.imports.preview');
   Route::post('/{batchId}/confirm', [ReferencePriceImportController::class, 'confirm'])->name('api.v1.admin.reference-prices.imports.confirm');
  });

  // Reusable prompts are private; only the read-only catalog is available in this stage.
  Route::get('/admin/ai-prompts', [AiPromptCatalogController::class, 'index'])->middleware('permission:integrations.manage')->name('api.v1.admin.ai-prompts.index');
  Route::get('/admin/ai-prompts/{code}', [AiPromptCatalogController::class, 'show'])->middleware('permission:integrations.manage')->name('api.v1.admin.ai-prompts.show');
  Route::get('/admin/ai-prompts/{code}/history', [AiPromptCatalogController::class, 'history'])->middleware('permission:integrations.manage')->name('api.v1.admin.ai-prompts.history');
  Route::post('/admin/ai-prompts', [AiPromptCatalogController::class, 'store'])->middleware('permission:ai_prompts.manage')->name('api.v1.admin.ai-prompts.store');
  Route::post('/admin/ai-prompts/{code}/versions', [AiPromptCatalogController::class, 'storeVersion'])->middleware('permission:ai_prompts.manage')->name('api.v1.admin.ai-prompts.versions.store');
  Route::patch('/admin/ai-prompts/{code}', [AiPromptCatalogController::class, 'update'])->middleware('permission:ai_prompts.manage')->name('api.v1.admin.ai-prompts.update');
  Route::delete('/admin/ai-prompts/{code}', [AiPromptCatalogController::class, 'destroy'])->middleware('permission:ai_prompts.manage')->name('api.v1.admin.ai-prompts.archive');
  Route::post('/admin/ai-prompts/{code}/reactivate', [AiPromptCatalogController::class, 'reactivate'])->middleware('permission:ai_prompts.manage')->name('api.v1.admin.ai-prompts.reactivate');
  Route::post('/admin/ai-prompts/{code}/revisions/{version}/restore', [AiPromptCatalogController::class, 'restoreRevision'])->middleware('permission:ai_prompts.manage')->whereNumber('version')->name('api.v1.admin.ai-prompts.revisions.restore');

  Route::post('/auth/logout',AuthLogoutController::class)->name('api.v1.auth.logout');
  Route::get('/auth/me',AuthMeController::class)->name('api.v1.auth.me');

  Route::prefix('admin/valuations')->middleware('permission:valuation.manage')->group(function (): void {
   Route::get('/',[DeviceValuationController::class,'index'])->name('api.v1.admin.valuations.index');
   Route::post('/',[DeviceValuationController::class,'store'])->name('api.v1.admin.valuations.store');
   Route::patch('/{id}',[DeviceValuationController::class,'update'])->name('api.v1.admin.valuations.update');
   Route::get('/{id}/photos',[ValuationPhotosController::class,'index'])->name('api.v1.admin.valuations.photos.index');
   Route::post('/{id}/photos/presign',[ValuationPhotosController::class,'presign'])->middleware('throttle:10,1')->name('api.v1.admin.valuations.photos.presign');
   Route::post('/{id}/photos/{photoId}/confirm',[ValuationPhotosController::class,'confirm'])->name('api.v1.admin.valuations.photos.confirm');
   Route::post('/{id}/photos/{photoId}/relay',[ValuationPhotosController::class,'relay'])->middleware('throttle:10,1')->name('api.v1.admin.valuations.photos.relay');
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
