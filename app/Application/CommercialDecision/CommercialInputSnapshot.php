<?php

declare(strict_types=1);

namespace App\Application\CommercialDecision;

use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Read-only snapshot: gathers verifiable operational facts for commercial analysis.
 * Does not create valuations, infer resale market prices, or mutate stock.
 */
final class CommercialInputSnapshot
{
    public function forDevice(string $id): array
    {
        $device = InventoryItem::query()->whereKey($id)->firstOrFail();
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

        $installedCost = (int) DB::table('device_installed_parts')
            ->where('inventory_item_id', $id)
            ->whereNull('voided_at')
            ->sum('cost_amount_minor');

        $hasSale = DB::table('device_sale_records')
            ->where('inventory_item_id', $id)
            ->whereNull('voided_at')
            ->exists();

        $hasExtraction = DB::table('device_part_extractions')
            ->where('donor_item_id', $id)->exists();

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
            'currency_code' => $device->currency_code ?? 'UYU',
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
            'can_plan_whole_device_sale' => !$hasSale && !$hasExtraction
                && !in_array($device->operational_status, ['sold', 'vendido'], true),
            'missing_inputs' => array_values(array_filter([
                $device->cost_amount_minor === null ? 'acquisition_cost' : null,
                $evaluation === null ? 'technical_evaluation' : null,
                'comparable_resale_market_price',
            ])),
        ];
    }
}
