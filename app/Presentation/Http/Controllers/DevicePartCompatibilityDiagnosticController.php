<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;

final class DevicePartCompatibilityDiagnosticController extends Controller
{
    public function index(Request $request, string $id): JsonResponse
    {
        $data = $request->validate(['sku' => ['nullable', 'string', 'max:60']]);
        $device = InventoryItem::query()->whereKey($id)
            ->whereIn('item_type', ['device', 'used_phone'])->firstOrFail();

        $parts = InventoryItem::query()->where('item_type', 'spare_part')
            ->when(isset($data['sku']), fn ($query) => $query->where('sku', $data['sku']))
            ->orderBy('sku')->limit(100)->get();

        $held = DB::table('order_items')->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereIn('order_items.inventory_item_id', $parts->pluck('id')->all())
            ->whereIn('orders.status', ['pending', 'processing', 'ready'])
            ->select('order_items.inventory_item_id', DB::raw('SUM(order_items.quantity) as quantity'))
            ->groupBy('order_items.inventory_item_id')->pluck('quantity', 'inventory_item_id');

        $checker = new DeviceInstalledPartsController();
        $results = $parts->map(function (InventoryItem $part) use ($device, $held, $checker): array {
            $stock = (int) $part->stock_quantity;
            $reserved = (int) ($held[$part->id] ?? 0);
            $modelMatched = $checker->compatible($device, $part);
            $ownerMatched = $part->consignor_id === null || $part->consignor_id === $device->consignor_id;
            $reasons = [];
            if (!$modelMatched) $reasons[] = 'model_mismatch';
            if (!$ownerMatched) $reasons[] = 'owner_mismatch';
            if ($stock <= 0) $reasons[] = 'out_of_stock';
            if ($stock > 0 && $stock <= $reserved) $reasons[] = 'reserved_stock';

            $modelId = $device->metadata['device_model_id'] ?? null;
            $links = DB::table('inventory_part_model_compatibilities')
                ->where('inventory_item_id', $part->id)->pluck('device_model_id')->all();
            return [
                'sku' => $part->sku, 'title' => $part->title,
                'eligible' => $reasons === [], 'reasons' => $reasons,
                'stock_quantity' => $stock, 'reserved_quantity' => $reserved,
                'available_quantity' => max(0, $stock - $reserved),
                'model_id_present_on_device' => (bool) $modelId,
                'model_id_present_on_part' => (bool) ($part->metadata['device_model_id'] ?? null),
                'has_explicit_model_links' => $links !== [],
                'explicit_link_matches_device' => $modelId !== null && in_array($modelId, $links, true),
            ];
        })->values()->all();

        return response()->json(['data' => ['device_id' => $id, 'results' => $results]])
            ->header('Cache-Control', 'private, no-store');
    }
}
