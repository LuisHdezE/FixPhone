<?php

declare(strict_types=1);

namespace App\Infrastructure\CommercialDecision;

use App\Application\CommercialDecision\CommercialInputSnapshot;

use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Read-only snapshot: gathers verifiable operational facts for commercial analysis.
 * Does not create valuations, infer resale market prices, or mutate stock.
 */
final class DatabaseCommercialInputSnapshot implements CommercialInputSnapshot
{
    public function forDevice(string $id): array
    {
        // Inventory writers lock this same row, so all dependent facts belong
        // to one serialized operational state. No operational records are written.
        return DB::transaction(fn (): array => $this->readLocked($id));
    }

    private function readLocked(string $id): array
    {
        $device = InventoryItem::query()->whereKey($id)->lockForUpdate()->firstOrFail();
        if (!in_array($device->item_type, ['device', 'used_phone'], true)) {
            throw ValidationException::withMessages(['device' => 'La valoración comercial exige un dispositivo individual.']);
        }

        $evaluation = DB::table('device_technical_evaluations')
            ->where('inventory_item_id', $id)
            ->orderByDesc('revision')
            ->first();

        $checks = $evaluation === null ? [] : DB::table('device_technical_checks')
            ->where('evaluation_id', $evaluation->id)
            ->orderBy('check_key')
            ->get(['check_key', 'result', 'notes'])
            ->map(fn (object $check): array => [
                'key' => $check->check_key,
                'result' => $check->result,
                'notes' => $check->notes,
            ])->all();

        $parts = DB::table('device_installed_parts')->where('inventory_item_id', $id)->whereNull('voided_at');
        $currency = $device->currency_code;
        $invalidPartCosts = (clone $parts)->where(function ($query) use ($currency): void {
            $query->where('currency_code', '!=', $currency)->orWhereNull('currency_code')
                ->orWhere('cost_amount_minor', '<', 0);
        })->exists();
        // Own stock keeps the zero cost recorded by the installation workflow.
        $installedCost = $invalidPartCosts ? null : (int) (clone $parts)->sum('cost_amount_minor');

        $hasSale = DB::table('device_sale_records')
            ->where('inventory_item_id', $id)
            ->whereNull('voided_at')
            ->exists();

        $hasExtraction = DB::table('device_part_extractions')
            ->where('donor_item_id', $id)->exists();

        $hasReservation = DB::table('order_items')->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('order_items.inventory_item_id', $id)
            ->whereIn('orders.status', ['pending', 'processing', 'ready'])->exists();

        return [
            'inventory_item_id' => $device->id,
            'sku' => $device->sku,
            'title' => $device->title,
            'brand' => $device->brand,
            'model' => $device->model,
            'inventory_purpose' => $device->inventory_purpose,
            'operational_status' => $device->operational_status,
            'dismantling_status' => $device->dismantling_status,
            'is_consigned' => $device->consignor_id !== null || in_array($device->inventory_purpose, [
                'consignation', 'consigned', 'consignacion', 'consigned_phone', 'sell_as_consigned',
            ], true),
            'currency_code' => $currency,
            'acquisition_cost_minor' => $device->cost_amount_minor,
            'installed_parts_cost_minor' => $installedCost,
            'technical_evaluation' => $evaluation === null ? null : [
                'id' => $evaluation->id,
                'revision' => (int) $evaluation->revision,
                'overall_result' => $evaluation->overall_result,
                'recorded_at' => $evaluation->created_at,
                'checks' => $checks,
            ],
            'has_active_sale' => $hasSale,
            'has_extracted_parts' => $hasExtraction,
            'has_open_reservation' => $hasReservation,
            'can_plan_whole_device_sale' => !$hasSale && !$hasExtraction && !$hasReservation
                && (int) $device->stock_quantity === 1
                && !in_array($device->dismantling_status, ['partial', 'exhausted'], true)
                && !in_array($device->operational_status, ['sold', 'vendido'], true),
            'missing_inputs' => array_values(array_filter([
                $device->cost_amount_minor === null ? 'acquisition_cost' : null,
                $evaluation === null ? 'technical_evaluation' : null,
                $invalidPartCosts ? 'installed_parts_cost_currency_or_amount' : null,
                'comparable_resale_market_price',
            ])),
        ];
    }
}
