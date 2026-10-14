<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Customer\Customer;
use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class CommercialOrdersController extends Controller
{
    private const OPEN_STATES = ['pending', 'processing', 'ready'];
    private const ITEM_TYPES = ['device', 'used_phone', 'spare_part', 'accessory'];

    public function index(Request $request): JsonResponse
    {
        $filter = $request->validate([
            'status' => ['sometimes', Rule::in([...self::OPEN_STATES, 'cancelled'])],
            'search' => ['sometimes', 'nullable', 'string', 'max:150'],
        ]);
        $query = DB::table('orders')->orderByDesc('created_at')->orderByDesc('id');
        if (isset($filter['status'])) $query->where('status', $filter['status']);
        if (!empty($filter['search'])) {
            $search = '%'.str_replace(['%', '_'], ['\\%', '\\_'], trim($filter['search'])).'%';
            $query->where(static function ($q) use ($search): void {
                $q->where('order_number', 'like', $search)->orWhere('customer_name_snapshot', 'like', $search);
            });
        }

        return response()->json(['data' => $query->get()->map(fn ($row) => $this->details($row))->all()]);
    }

    public function show(string $id): JsonResponse
    {
        return response()->json(['data' => $this->details(DB::table('orders')->where('id', $id)->firstOrFail())]);
    }

    public function catalog(Request $request): JsonResponse
    {
        $filter = $request->validate(['order_id' => ['sometimes', 'string', Rule::exists('orders', 'id')]]);
        $excludeOrderId = $filter['order_id'] ?? null;
        if ($excludeOrderId !== null && DB::table('orders')->where('id', $excludeOrderId)->value('status') !== 'pending') {
            abort(409, 'Solo los pedidos pendientes se pueden editar.');
        }
        $customers = Customer::query()->orderBy('full_name')->get(['id', 'full_name', 'relationship_state']);
        $stock = InventoryItem::query()->whereIn('item_type', self::ITEM_TYPES)
            ->where('is_sellable', true)->where('stock_quantity', '>', 0)
            ->whereNotNull('sale_price_amount_minor')
            ->orderBy('title')->get();

        $items = $stock->filter(static fn (InventoryItem $item) =>
            !in_array($item->operational_status, ['sold', 'vendido'], true)
            && !((bool) ($item->metadata['is_mvp_demo'] ?? false))
            && !((bool) ($item->metadata['is_demo'] ?? false))
        )->map(function (InventoryItem $item) use ($excludeOrderId): array {
            return [
                'id' => $item->id,
                'sku' => $item->sku,
                'title' => $item->title,
                'item_type' => $item->item_type,
                'currency_code' => $item->currency_code,
                'unit_price_minor' => (int) $item->sale_price_amount_minor,
                'available_quantity' => max(0, (int) $item->stock_quantity - $this->heldQuantity($item->id, $excludeOrderId)),
            ];
        })->filter(static fn (array $item): bool => $item['available_quantity'] > 0)->values();

        return response()->json(['data' => [
            'customers' => $customers,
            'items' => $items,
        ]]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request);
        $id = (string) Str::ulid();

        DB::transaction(function () use ($request, $data, $id): void {
            $customer = Customer::query()->whereKey($data['customer_id'])->lockForUpdate()->firstOrFail();
            $lines = $this->buildLines($data['items'], null);
            $total = array_sum(array_column($lines, 'line_total_minor'));
            $currency = $lines[0]['currency_code'];

            DB::table('orders')->insert([
                'id' => $id,
                'order_number' => 'FP-'.strtoupper(substr($id, -12)),
                'customer_id' => $customer->id,
                'customer_name_snapshot' => $customer->full_name,
                'status' => 'pending',
                'currency_code' => $currency,
                'total_amount_minor' => $total,
                'notes' => $data['notes'] ?? null,
                'created_by_actor_id' => (string) $request->user()->getAuthIdentifier(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $this->saveLines($id, $lines);
            $this->audit($request, $id, 'orders.created', 'create', [
                'item_count' => count($lines), 'total_minor' => $total, 'currency_code' => $currency,
            ]);
        });

        return response()->json(['data' => $this->details(DB::table('orders')->where('id', $id)->firstOrFail())], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $data = $this->validateData($request);

        DB::transaction(function () use ($request, $data, $id): void {
            $order = DB::table('orders')->where('id', $id)->lockForUpdate()->firstOrFail();
            if ($order->status !== 'pending') abort(409, 'Solo se pueden editar pedidos pendientes.');

            $customer = Customer::query()->whereKey($data['customer_id'])->lockForUpdate()->firstOrFail();
            $lines = $this->buildLines($data['items'], $id);
            $currency = $lines[0]['currency_code'];
            $total = array_sum(array_column($lines, 'line_total_minor'));

            DB::table('order_items')->where('order_id', $id)->delete();
            $this->saveLines($id, $lines);
            DB::table('orders')->where('id', $id)->update([
                'customer_id' => $customer->id,
                'customer_name_snapshot' => $customer->full_name,
                'currency_code' => $currency,
                'total_amount_minor' => $total,
                'notes' => $data['notes'] ?? null,
                'updated_by_actor_id' => (string) $request->user()->getAuthIdentifier(),
                'updated_at' => now(),
            ]);
            $this->audit($request, $id, 'orders.updated', 'update', [
                'item_count' => count($lines), 'total_minor' => $total, 'currency_code' => $currency,
            ]);
        });

        return response()->json(['data' => $this->details(DB::table('orders')->where('id', $id)->firstOrFail())]);
    }

    public function changeStatus(Request $request, string $id): JsonResponse
    {
        $this->rejectUnexpected($request, ['status', 'reason']);
        $data = $request->validate([
            'status' => ['required', Rule::in(['processing', 'ready', 'cancelled'])],
            'reason' => ['required_if:status,cancelled', 'nullable', 'string', 'min:5', 'max:300'],
        ]);
        DB::transaction(function () use ($request, $id, $data): void {
            $order = DB::table('orders')->where('id', $id)->lockForUpdate()->firstOrFail();
            $allowed = match ($order->status) {
                'pending' => ['processing', 'cancelled'],
                'processing' => ['ready', 'cancelled'],
                'ready' => ['cancelled'],
                default => [],
            };
            if (!in_array($data['status'], $allowed, true)) abort(409, 'Transición de pedido no permitida.');

            // Validate that the physical stock has not been sold elsewhere.
            if ($data['status'] !== 'cancelled') {
                foreach (DB::table('order_items')->where('order_id', $id)->get() as $line) {
                    $item = InventoryItem::query()->whereKey($line->inventory_item_id)->lockForUpdate()->first();
                    if (!$item || !$item->is_sellable || $item->stock_quantity < $line->quantity
                        || in_array($item->operational_status, ['sold', 'vendido'], true)) {
                        abort(409, 'Un artículo del pedido ya no está disponible. Revisá el inventario.');
                    }
                }
            }

            DB::table('orders')->where('id', $id)->update([
                'status' => $data['status'],
                'cancelled_at' => $data['status'] === 'cancelled' ? now() : null,
                'cancel_reason' => $data['status'] === 'cancelled' ? trim($data['reason']) : null,
                'cancelled_by_actor_id' => $data['status'] === 'cancelled' ? (string) $request->user()->getAuthIdentifier() : null,
                'updated_by_actor_id' => (string) $request->user()->getAuthIdentifier(),
                'updated_at' => now(),
            ]);
            $this->audit($request, $id, 'orders.status_changed', 'update', [
                'previous_status' => $order->status, 'new_status' => $data['status'],
                'reason' => $data['status'] === 'cancelled' ? trim($data['reason']) : null,
            ]);
        });

        return response()->json(['data' => $this->details(DB::table('orders')->where('id', $id)->firstOrFail())]);
    }

    private function validateData(Request $request): array
    {
        $this->rejectUnexpected($request, ['customer_id', 'notes', 'items']);
        $data = $request->validate([
            'customer_id' => ['required', 'string', Rule::exists('crm_customers', 'id')->whereNull('deleted_at')],
            'notes' => ['nullable', 'string', 'max:4000'],
            'items' => ['required', 'array', 'min:1', 'max:30'],
            'items.*' => ['required', 'array:inventory_item_id,quantity'],
            'items.*.inventory_item_id' => ['required', 'string', 'distinct', Rule::exists('inventory_items', 'id')->whereNull('deleted_at')],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:1000'],
        ]);
        foreach ($data['items'] as $item) {
            if (array_diff(array_keys($item), ['inventory_item_id', 'quantity'])) {
                throw ValidationException::withMessages(['items' => 'Los artículos no admiten precios ni atributos modificados desde el navegador.']);
            }
        }
        return $data;
    }

    private function buildLines(array $inputs, ?string $excludeOrderId): array
    {
        usort($inputs, static fn (array $a, array $b): int => strcmp($a['inventory_item_id'], $b['inventory_item_id']));
        $lines = [];
        $currency = null;
        $total = 0;

        foreach ($inputs as $input) {
            $item = InventoryItem::query()->whereKey($input['inventory_item_id'])->lockForUpdate()->firstOrFail();
            $quantity = (int) $input['quantity'];
            $metadata = $item->metadata ?? [];
            if (!in_array($item->item_type, self::ITEM_TYPES, true)
                || !$item->is_sellable || (int) $item->stock_quantity < $quantity
                || in_array($item->operational_status, ['sold', 'vendido'], true)
                || !is_int($item->sale_price_amount_minor)
                || $item->sale_price_amount_minor < 0
                || ($metadata['is_mvp_demo'] ?? false) || ($metadata['is_demo'] ?? false)) {
                throw ValidationException::withMessages(['items' => 'Un artículo no está disponible o no tiene precio de venta válido.']);
            }

            if (in_array($item->item_type, ['device', 'used_phone'], true) && $quantity !== 1) {
                throw ValidationException::withMessages(['items' => 'Un teléfono individual solo puede tener cantidad 1.']);
            }
            if (in_array($item->item_type, ['device', 'used_phone'], true)
                && DB::table('device_sale_records')->where('inventory_item_id', $item->id)->whereNull('voided_at')->exists()) {
                abort(409, 'El teléfono ya está vendido.');
            }

            $held = $this->heldQuantity($item->id, $excludeOrderId);
            if ($quantity + $held > (int) $item->stock_quantity) {
                abort(409, 'Las cantidades comprometidas en pedidos pendientes superan las unidades disponibles.');
            }

            $itemCurrency = $item->currency_code ?: 'UYU';
            if ($currency !== null && $currency !== $itemCurrency) {
                throw ValidationException::withMessages(['items' => 'No se pueden combinar monedas en un mismo pedido.']);
            }
            $currency = $itemCurrency;

            $unit = (int) $item->sale_price_amount_minor;
            $subtotal = $unit * $quantity;
            if ($subtotal > 1000000000000 || $total + $subtotal > 1000000000000) {
                throw ValidationException::withMessages(['items' => 'El total supera el importe máximo admitido.']);
            }
            $total += $subtotal;
            $lines[] = [
                'inventory_item_id' => $item->id,
                'item_sku_snapshot' => $item->sku,
                'item_name_snapshot' => $item->title,
                'item_type_snapshot' => $item->item_type,
                'quantity' => $quantity,
                'unit_price_minor' => $unit,
                'line_total_minor' => $subtotal,
                'currency_code' => $itemCurrency,
            ];
        }
        return $lines;
    }

    private function heldQuantity(string $itemId, ?string $excludeOrderId = null): int
    {
        return (int) DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('order_items.inventory_item_id', $itemId)
            ->whereIn('orders.status', self::OPEN_STATES)
            ->when($excludeOrderId !== null, static fn ($q) => $q->where('orders.id', '!=', $excludeOrderId))
            ->sum('order_items.quantity');
    }

    private function saveLines(string $orderId, array $lines): void
    {
        $now = now();
        foreach ($lines as $line) {
            unset($line['currency_code']);
            DB::table('order_items')->insert([
                ...$line,
                'id' => (string) Str::ulid(),
                'order_id' => $orderId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    private function details(object $order): array
    {
        return [
            'id' => $order->id,
            'number' => $order->order_number,
            'customer_id' => $order->customer_id,
            'customer_name' => $order->customer_name_snapshot,
            'status' => $order->status,
            'total_amount_minor' => (int) $order->total_amount_minor,
            'currency_code' => $order->currency_code,
            'notes' => $order->notes,
            'cancel_reason' => $order->cancel_reason,
            'created_at' => $order->created_at,
            'items' => DB::table('order_items')->where('order_id', $order->id)->orderBy('item_name_snapshot')
                ->get(['inventory_item_id', 'item_sku_snapshot', 'item_name_snapshot', 'quantity', 'unit_price_minor', 'line_total_minor'])
                ->all(),
        ];
    }

    private function rejectUnexpected(Request $request, array $allowed): void
    {
        if (array_diff(array_keys($request->all()), $allowed)) {
            throw ValidationException::withMessages(['order' => 'Se recibieron campos no permitidos.']);
        }
    }

    private function audit(Request $request, string $id, string $event, string $action, array $changes): void
    {
        DB::table('audit_events')->insert([
            'id' => (string) Str::ulid(),
            'event_type' => $event,
            'action' => $action,
            'entity_type' => 'CommercialOrder',
            'entity_id' => $id,
            'actor_type' => 'user',
            'actor_id' => (string) $request->user()->getAuthIdentifier(),
            'correlation_id' => $request->attributes->get('correlation_id'),
            'metadata' => json_encode($changes),
            'occurred_at' => now(),
        ]);
    }
}
