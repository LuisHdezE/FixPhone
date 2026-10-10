<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Valuation\DeviceValuation;
use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class DeviceValuationController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => DeviceValuation::query()->orderByDesc('updated_at')->orderByDesc('id')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules(false));
        $this->checkPrices($validated);
        $this->checkPublicListing($validated);
        $item = DB::transaction(function () use ($request, $validated): DeviceValuation {
            $item = DeviceValuation::query()->create([
                ...$validated,
                'created_by' => (string) $request->user()->getAuthIdentifier(),
            ]);
            $this->audit($request, $item, 'created');
            return $item;
        });
        return response()->json(['data' => $item], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $item = DeviceValuation::query()->findOrFail($id);
        $validated = $request->validate($this->rules(true));
        $current = array_merge($item->only([
            'estimated_min_minor', 'estimated_max_minor', 'asking_price_minor',
            'minimum_price_minor', 'publication_status', 'inventory_item_id',
            'public_listing_status', 'public_image_url', 'public_description',
            'provenance_confirmed',
        ]), $validated);
        $this->checkPrices($current);
        $this->checkPublicListing($current);

        DB::transaction(function () use ($request, $item, $validated): void {
            $item->fill($validated)->save();
            $this->audit($request, $item, 'updated');
        });
        return response()->json(['data' => $item->refresh()]);
    }

    private function rules(bool $partial): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return [
            'inventory_item_id' => [
                'sometimes', 'nullable', 'ulid',
                Rule::exists('inventory_items', 'id')->whereIn('item_type', ['device', 'used_phone']),
                Rule::unique('device_valuations', 'inventory_item_id')->ignore(request()->route('id')),
            ],
            'model_name' => [$required, 'string', 'max:120'],
            'fault_type' => [$required, Rule::in(['icloud', 'no_signal', 'board', 'other'])],
            'screen_condition' => ['sometimes', Rule::in(['good', 'damaged', 'unknown'])],
            'power_state' => ['sometimes', Rule::in(['yes', 'no', 'unknown'])],
            'estimated_min_minor' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'estimated_max_minor' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'asking_price_minor' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'minimum_price_minor' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'publication_status' => ['sometimes', Rule::in(['draft', 'published', 'closed'])],
            'market_reference' => ['sometimes', 'nullable', 'string', 'max:4000'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:4000'],
            'facebook_copy' => ['sometimes', 'nullable', 'string', 'max:4000'],
            'facebook_post_url' => ['sometimes', 'nullable', 'url', 'max:2048'],
            'public_listing_status' => ['sometimes', Rule::in(['draft', 'published'])],
            'public_image_url' => ['sometimes', 'nullable', 'url', 'starts_with:https://', 'max:2048'],
            'public_description' => ['sometimes', 'nullable', 'string', 'max:1500'],
            'provenance_confirmed' => ['sometimes', 'boolean'],
        ];
    }

    private function checkPublicListing(array $values): void
    {
        if (($values['public_listing_status'] ?? 'draft') !== 'published') {
            return;
        }

        $error = [];
        if (empty($values['provenance_confirmed'])) {
            $error['provenance_confirmed'] = 'Confirmá que el equipo tiene procedencia legítima.';
        }
        if (empty($values['public_description']) || mb_strlen(trim($values['public_description'])) < 20) {
            $error['public_description'] = 'Describí el estado real del equipo (mínimo 20 caracteres).';
        }
        if (empty($values['public_image_url'])) {
            $error['public_image_url'] = 'Ingresá una URL HTTPS de una fotografía real.';
        }
        if (empty($values['asking_price_minor']) || $values['asking_price_minor'] <= 0) {
            $error['asking_price_minor'] = 'Indicá un precio de venta mayor que cero.';
        }
        $inventory = isset($values['inventory_item_id'])
            ? InventoryItem::query()->find($values['inventory_item_id'])
            : null;
        if ($inventory === null ||
            !in_array($inventory->item_type, ['device', 'used_phone'], true) ||
            $inventory->inventory_purpose !== 'parts_donor' ||
            $inventory->stock_quantity < 1) {
            $error['inventory_item_id'] = 'Vinculá un teléfono del inventario marcado para repuestos y con stock.';
        }
        if ($inventory !== null && in_array($inventory->dismantling_status, ['partial', 'exhausted'], true)) {
            $error['inventory_item_id'] = 'Este equipo ya fue desarmado. No se puede publicar como unidad completa.';
        }
        if ($error) {
            throw ValidationException::withMessages($error);
        }
    }

    private function checkPrices(array $values): void
    {
        $min = $values['estimated_min_minor'] ?? null;
        $max = $values['estimated_max_minor'] ?? null;
        $ask = $values['asking_price_minor'] ?? null;
        $floor = $values['minimum_price_minor'] ?? null;

        if ($min !== null && $max !== null && $min > $max) {
            throw ValidationException::withMessages([
                'estimated_max_minor' => 'El máximo estimado debe ser mayor o igual que el mínimo.',
            ]);
        }
        if ($floor !== null && $ask !== null && $floor > $ask) {
            throw ValidationException::withMessages([
                'minimum_price_minor' => 'El precio mínimo no puede superar el precio de publicación.',
            ]);
        }
        if (($values['publication_status'] ?? 'draft') === 'published' && $ask === null) {
            throw ValidationException::withMessages([
                'asking_price_minor' => 'Define el precio antes de marcar la publicación como publicada.',
            ]);
        }
    }

    private function audit(Request $request, DeviceValuation $item, string $action): void
    {
        DB::table('audit_events')->insert([
            'id' => (string) Str::ulid(),
            'event_type' => 'VALUATION.'.strtoupper($action),
            'action' => $action,
            'entity_type' => 'DeviceValuation',
            'entity_id' => $item->id,
            'actor_type' => 'user',
            'actor_id' => (string) $request->user()->getAuthIdentifier(),
            'correlation_id' => $request->attributes->get('correlation_id'),
            'metadata' => json_encode([
                'inventory_item_id' => $item->inventory_item_id,
                'publication_status' => $item->publication_status,
            ]),
            'occurred_at' => now(),
        ]);
    }
}
