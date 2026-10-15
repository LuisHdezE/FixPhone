<?php
namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Inventory\ExtractDeviceComponents;
use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;

final class DeviceComponentExtractionController extends Controller
{
    public function options(string $id, ExtractDeviceComponents $service)
    {
        $donor = InventoryItem::query()->findOrFail($id);
        $service->assertDonor($donor);
        [$brand, $model] = $service->identity($donor);
        $types = array_values(array_filter($service->catalog(), fn ($type) => ($type['active'] ?? false) === true));
        usort($types, fn ($a, $b) => ($a['sortOrder'] ?? 0) <=> ($b['sortOrder'] ?? 0));
        return response()->json(['data' => [
            'donor_sku' => $donor->sku, 'brand' => $brand['name'], 'model' => $model['name'],
            'exhausted' => $donor->dismantling_status === 'exhausted', 'types' => $types,
            'extracted' => DB::table('device_part_extractions')->where('donor_item_id', $id)->get(['part_type_id', 'part_name', 'part_condition', 'spare_item_id', 'quantity_before', 'quantity_after', 'created_at']),
        ]])->header('Cache-Control', 'no-store');
    }

    public function store(Request $request, string $id, ExtractDeviceComponents $service)
    {
        $data = $request->validate([
            'request_id' => ['required', 'uuid'], 'currency' => ['required', 'in:UYU,USD'],
            'components' => ['required', 'array', 'min:1', 'max:100'],
            'components.*.type_id' => ['required', 'string', 'distinct', 'max:255'],
            'components.*.condition' => ['required', 'in:untested,functional,faulty'],
            'components.*.sale_price_minor' => ['nullable', 'integer', 'min:1', 'max:2147483647'],
            'components.*.image_url' => ['nullable', 'url:https', 'max:2048'],
            'components.*.publish' => ['sometimes', 'boolean'],
        ]);
        $publishing = collect($data['components'])->contains(fn ($row) => (bool) ($row['publish'] ?? false));
        abort_if($publishing && !app(\App\Application\Authorization\Contracts\AuthorizationGateway::class)->hasPermission((string) $request->user()->getAuthIdentifier(), 'catalog.manage'), 403);
        return response()->json(['data' => $service->execute($id, $data, (string) $request->user()->getAuthIdentifier())]);
    }
}
