<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Inventory\DeviceInstalledPart;
use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class DeviceInstalledPartsController extends Controller
{
    public function compatible(InventoryItem $device, InventoryItem $part): bool
    {
        if ($part->item_type !== 'spare_part') return false;
        $deviceMeta = $device->metadata ?? [];
        $partMeta = $part->metadata ?? [];
        $deviceModelId = $deviceMeta['device_model_id'] ?? null;
        $partModelId = $partMeta['device_model_id'] ?? null;
        $deviceBrandId = $deviceMeta['brand_id'] ?? null;
        $partBrandId = $partMeta['brand_id'] ?? null;

        // Explicit compatible-model relations take precedence over the single
        // legacy model stored in metadata. This supports shared components.
        if ($deviceModelId && DB::table('inventory_part_model_compatibilities')
            ->where('inventory_item_id', $part->id)->exists()) {
            return DB::table('inventory_part_model_compatibilities')
                ->where('inventory_item_id', $part->id)
                ->where('device_model_id', $deviceModelId)->exists();
        }

        // Fully identified catalog models must agree; names cannot override
        // a documented mismatch (e.g. A22 LTE vs A22 5G).
        if ($deviceModelId && $partModelId) {
            return $deviceModelId === $partModelId
                && (!$deviceBrandId || !$partBrandId || $deviceBrandId === $partBrandId);
        }
        if ($deviceBrandId && $partBrandId && $deviceBrandId !== $partBrandId) return false;

        // Legacy/quick intake may omit model IDs even though extracted parts
        // have them. Require an exact brand and model name match in that case.
        // Removing a repeated brand prefix allows "Galaxy A22 5G" and
        // "Samsung Galaxy A22 5G", but never guesses similar model numbers.
        $normalize = static fn (?string $value): string =>
            mb_strtolower(trim(preg_replace('/\\s+/u', ' ', $value ?? '')));
        $deviceBrand = $normalize($device->brand);
        $partBrand = $normalize($part->brand);
        if ($deviceBrand === '' || $deviceBrand !== $partBrand) return false;
        $normalizeModel = static function (?string $value) use ($normalize, $deviceBrand): string {
            $model = $normalize($value);
            if (str_starts_with($model, $deviceBrand.' ')) {
                $model = trim(mb_substr($model, mb_strlen($deviceBrand) + 1));
            }
            return $model;
        };
        $deviceModel = $normalizeModel($device->model);
        return $deviceModel !== '' && $deviceModel === $normalizeModel($part->model);
    }

    /**
     * Extraction is the explicit authorization to circulate recovered components
     * as spare parts; retain their consignor for audit and settlement history.
     */
    public function ownershipAllowed(InventoryItem $device, InventoryItem $part): bool
    {
        if ($part->consignor_id === null || $part->consignor_id === $device->consignor_id) return true;
        return $part->item_type === 'spare_part'
            && ($part->metadata['origin'] ?? null) === 'recovered'
            && ($part->component_identity_key !== null
                || DB::table('device_part_extractions')->where('spare_part_item_id', $part->id)->exists());
    }
    public function compatibleParts(string $id): JsonResponse
    {
        $device = InventoryItem::query()->whereKey($id)->whereIn('item_type', ['device', 'used_phone'])->firstOrFail();
        $parts = InventoryItem::query()->where('item_type', 'spare_part')->where('stock_quantity', '>', 0)
            ->orderBy('title')->get()->filter(fn (InventoryItem $part) => $this->compatible($device, $part)
                && $this->ownershipAllowed($device, $part));
        $ids = $parts->pluck('id')->all();
        $held = DB::table('order_items')->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereIn('order_items.inventory_item_id', $ids)
            ->whereIn('orders.status', ['pending', 'processing', 'ready'])
            ->select('order_items.inventory_item_id', DB::raw('SUM(order_items.quantity) as quantity'))
            ->groupBy('order_items.inventory_item_id')->pluck('quantity', 'inventory_item_id');
        return response()->json(['data' => $parts->filter(fn (InventoryItem $part) => $part->stock_quantity > (int) ($held[$part->id] ?? 0))
            ->map(fn (InventoryItem $part) => ['id' => $part->id, 'sku' => $part->sku, 'title' => $part->title,
                'stock_quantity' => (int) $part->stock_quantity - (int) ($held[$part->id] ?? 0)])
            ->values()->all()])->header('Cache-Control', 'private, no-store');
    }

    public function index(string $id): JsonResponse
    {
        $device = InventoryItem::query()
            ->whereKey($id)
            ->whereIn('item_type', ['device', 'used_phone'])
            ->firstOrFail();

        $parts = DeviceInstalledPart::query()
            ->where('inventory_item_id', $id)
            ->orderByDesc('installed_at')
            ->orderByDesc('id')
            ->get();

        $activeParts = $parts->whereNull('voided_at');
        $totalCostMinor = (int) $activeParts->sum('cost_amount_minor');

        return response()->json([
            'data' => [
                'device' => [
                    'id' => $device->id,
                    'sku' => $device->sku,
                    'title' => $device->title,
                    'brand' => $device->brand,
                    'model' => $device->model,
                    'cost_amount_minor' => $device->cost_amount_minor,
                    'sale_price_amount_minor' => $device->sale_price_amount_minor,
                    'currency_code' => $device->currency_code,
                    'operational_status' => $device->operational_status,
                    'inventory_purpose' => $device->inventory_purpose,
                ],
                'installed_parts' => $parts->map(fn (DeviceInstalledPart $part) => $this->transformPart($part))->values()->all(),
                'total_installed_parts_cost_minor' => $totalCostMinor,
                'currency_code' => $device->currency_code ?? 'UYU',
            ],
        ]);
    }

    public function store(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'request_id' => ['required', 'uuid'],
            'part_name' => ['required', 'string', 'min:2', 'max:255'],
            'cost_amount_minor' => ['required', 'integer', 'between:0,100000000'],
            'spare_part_item_id' => ['nullable', 'string'],
            'currency_code' => ['sometimes', 'string', 'size:3'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'installed_at' => ['sometimes', 'nullable', 'date'],
        ]);

        $result = DB::transaction(function () use ($request, $id, $validated): array {
            $device = InventoryItem::query()
                ->whereKey($id)
                ->whereIn('item_type', ['device', 'used_phone'])
                ->lockForUpdate()
                ->firstOrFail();

            if (in_array($device->operational_status, ['vendido', 'sold'], true)) {
                throw ValidationException::withMessages([
                    'part_name' => 'No se pueden registrar nuevos repuestos instalados en un equipo que ya fue vendido y liquidado.',
                ]);
            }

            $currency = strtoupper($validated['currency_code'] ?? $device->currency_code ?? 'UYU');
            if ($currency !== strtoupper($device->currency_code ?? 'UYU')) {
                throw ValidationException::withMessages([
                    'currency_code' => 'La moneda del repuesto debe coincidir con la moneda del equipo.',
                ]);
            }

            $existing = DeviceInstalledPart::query()
                ->where('request_id', $validated['request_id'])
                ->first();

            if ($existing !== null) {
                if ($existing->inventory_item_id !== $id
                    || $existing->part_name !== $validated['part_name']
                    || (int) $existing->cost_amount_minor !== (int) $validated['cost_amount_minor']) {
                    throw ValidationException::withMessages([
                        'request_id' => 'Esta solicitud ya se utilizó para una operación distinta.',
                    ]);
                }
                return ['part' => $existing, 'replayed' => true];
            }

            $sparePartItem = null;
            if (!empty($validated['spare_part_item_id'])) {
                // A part already acquired into inventory has zero incremental purchase
                // cost for this device; its historical inventory cost remains separate.
                if ((int) $validated['cost_amount_minor'] !== 0) {
                    throw ValidationException::withMessages([
                        'cost_amount_minor' => 'Al instalar un repuesto existente del inventario, el costo adicional del equipo debe ser cero.',
                    ]);
                }
                $sparePartItem = InventoryItem::query()
                    ->whereKey($validated['spare_part_item_id'])
                    ->lockForUpdate()
                    ->first();

                if ($sparePartItem === null) {
                    throw ValidationException::withMessages([
                        'spare_part_item_id' => 'El repuesto seleccionado no existe en el catálogo de inventario.',
                    ]);
                }

                if ($sparePartItem->item_type !== 'spare_part') {
                    throw ValidationException::withMessages([
                        'spare_part_item_id' => 'Seleccioná un artículo de tipo repuesto.',
                    ]);
                }
                if (!$this->compatible($device, $sparePartItem)) {
                    throw ValidationException::withMessages([
                        'spare_part_item_id' => 'Este repuesto no es compatible con la marca y modelo del dispositivo.',
                    ]);
                }
                if (!$this->ownershipAllowed($device, $sparePartItem)) {
                    throw ValidationException::withMessages([
                        'spare_part_item_id' => 'El repuesto pertenece a un consignante diferente. Revisá la autorización de uso.',
                    ]);
                }
                $held = (int) DB::table('order_items')
                    ->join('orders', 'orders.id', '=', 'order_items.order_id')
                    ->where('order_items.inventory_item_id', $sparePartItem->id)
                    ->whereIn('orders.status', ['pending', 'processing', 'ready'])
                    ->sum('order_items.quantity');
                if ((int) $sparePartItem->stock_quantity - $held < 1) {
                    throw ValidationException::withMessages([
                        'spare_part_item_id' => 'El repuesto no tiene existencias libres: pueden estar reservadas para pedidos.',
                    ]);
                }

                $before = (int) $sparePartItem->stock_quantity;
                $after = $before - 1;
                $sparePartItem->stock_quantity = $after;
                $sparePartItem->save();

                $adjustmentId = (string) Str::ulid();
                DB::table('inventory_stock_adjustments')->insert([
                    'id' => $adjustmentId,
                    'inventory_item_id' => $sparePartItem->id,
                    'request_id' => (string) Str::uuid(),
                    'quantity_before' => $before,
                    'quantity_delta' => -1,
                    'quantity_after' => $after,
                    'reason' => 'Instalación de repuesto en equipo ' . ($device->sku ?? $device->id),
                    'actor_id' => (string) $request->user()->getAuthIdentifier(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $this->audit($request, $sparePartItem->id, 'InventoryItem', 'inventory.stock_adjusted', [
                    'stock_adjustment_id' => $adjustmentId,
                    'before' => $before,
                    'delta' => -1,
                    'after' => $after,
                    'reason' => 'Instalación de repuesto en equipo ' . ($device->sku ?? $device->id),
                ]);
            }

            $installedPart = DeviceInstalledPart::create([
                'id' => (string) Str::ulid(),
                'inventory_item_id' => $device->id,
                'spare_part_item_id' => $sparePartItem?->id,
                'part_name' => trim($validated['part_name']),
                'cost_amount_minor' => (int) $validated['cost_amount_minor'],
                'currency_code' => $currency,
                'installed_at' => !empty($validated['installed_at']) ? Carbon\Carbon::parse($validated['installed_at']) : now(),
                'installed_by_actor_id' => (string) $request->user()->getAuthIdentifier(),
                'notes' => $validated['notes'] ?? null,
                'request_id' => $validated['request_id'],
            ]);

            $this->audit($request, $installedPart->id, 'DeviceInstalledPart', 'device.part_installed', [
                'inventory_item_id' => $device->id,
                'part_name' => $installedPart->part_name,
                'cost_amount_minor' => $installedPart->cost_amount_minor,
                'spare_part_item_id' => $installedPart->spare_part_item_id,
            ]);

            return ['part' => $installedPart, 'replayed' => false];
        });

        return response()->json([
            'data' => $this->transformPart($result['part']),
            'replayed' => $result['replayed'],
        ], $result['replayed'] ? 200 : 201);
    }

    public function void(Request $request, string $id, string $partId): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:300'],
            'return_to_stock' => ['sometimes', 'boolean'],
        ]);

        $returnToStock = (bool) ($validated['return_to_stock'] ?? true);

        $part = DB::transaction(function () use ($request, $id, $partId, $validated, $returnToStock): DeviceInstalledPart {
            $device = InventoryItem::query()->whereKey($id)->firstOrFail();

            if (in_array($device->operational_status, ['vendido', 'sold'], true)) {
                throw ValidationException::withMessages([
                    'reason' => 'No se pueden anular repuestos instalados de un equipo que ya fue vendido y liquidado.',
                ]);
            }

            $part = DeviceInstalledPart::query()
                ->whereKey($partId)
                ->where('inventory_item_id', $device->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($part->voided_at !== null) {
                throw ValidationException::withMessages([
                    'reason' => 'Este registro de repuesto ya fue anulado previamente.',
                ]);
            }

            if ($returnToStock && !empty($part->spare_part_item_id)) {
                $sparePart = InventoryItem::query()
                    ->whereKey($part->spare_part_item_id)
                    ->lockForUpdate()
                    ->first();

                if ($sparePart !== null) {
                    $before = (int) $sparePart->stock_quantity;
                    $after = $before + 1;
                    $sparePart->stock_quantity = $after;
                    $sparePart->save();

                    $adjustmentId = (string) Str::ulid();
                    DB::table('inventory_stock_adjustments')->insert([
                        'id' => $adjustmentId,
                        'inventory_item_id' => $sparePart->id,
                        'request_id' => (string) Str::uuid(),
                        'quantity_before' => $before,
                        'quantity_delta' => 1,
                        'quantity_after' => $after,
                        'reason' => 'Anulación con devolución a inventario de equipo ' . ($device->sku ?? $device->id) . ': ' . $validated['reason'],
                        'actor_id' => (string) $request->user()->getAuthIdentifier(),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    $this->audit($request, $sparePart->id, 'InventoryItem', 'inventory.stock_adjusted', [
                        'stock_adjustment_id' => $adjustmentId,
                        'before' => $before,
                        'delta' => 1,
                        'after' => $after,
                        'reason' => 'Anulación de instalación en equipo ' . ($device->sku ?? $device->id),
                    ]);
                }
            }

            $part->voided_at = now();
            $part->voided_by_actor_id = (string) $request->user()->getAuthIdentifier();
            $part->void_reason = trim($validated['reason']) . ($returnToStock ? '' : ' (Sin devolución física a inventario)');
            $part->save();

            $this->audit($request, $part->id, 'DeviceInstalledPart', 'device.part_voided', [
                'inventory_item_id' => $device->id,
                'part_name' => $part->part_name,
                'cost_amount_minor' => $part->cost_amount_minor,
                'return_to_stock' => $returnToStock,
                'reason' => $part->void_reason,
            ]);

            return $part;
        });

        return response()->json([
            'data' => $this->transformPart($part),
        ]);
    }

    private function transformPart(DeviceInstalledPart $part): array
    {
        return [
            'id' => $part->id,
            'inventory_item_id' => $part->inventory_item_id,
            'spare_part_item_id' => $part->spare_part_item_id,
            'part_name' => $part->part_name,
            'cost_amount_minor' => (int) $part->cost_amount_minor,
            'currency_code' => $part->currency_code,
            'installed_at' => $part->installed_at?->toIso8601String(),
            'installed_by_actor_id' => $part->installed_by_actor_id,
            'notes' => $part->notes,
            'voided_at' => $part->voided_at?->toIso8601String(),
            'voided_by_actor_id' => $part->voided_by_actor_id,
            'void_reason' => $part->void_reason,
            'created_at' => $part->created_at?->toIso8601String(),
        ];
    }

    private function audit(Request $request, string $id, string $entityType, string $event, array $changes): void
    {
        DB::table('audit_events')->insert([
            'id' => (string) Str::ulid(),
            'event_type' => $event,
            'action' => 'update',
            'entity_type' => $entityType,
            'entity_id' => $id,
            'actor_type' => 'user',
            'actor_id' => (string) $request->user()->getAuthIdentifier(),
            'correlation_id' => $request->attributes->get('correlation_id'),
            'metadata' => json_encode($changes),
            'occurred_at' => now(),
        ]);
    }
}
