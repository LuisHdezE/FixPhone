<?php

declare(strict_types=1);

namespace App\Application\CommercialDecision;

use App\Domain\CommercialDecision\ScenarioCalculator;
use InvalidArgumentException;

/**
 * Compares explicit price hypotheses against a read-only device snapshot.
 * This is not an operational sale, dismantling or stock transaction.
 */
final class CompareCommercialScenarios
{
    public function __construct(private readonly ScenarioCalculator $calculator) {}

    /**
     * @param array<string,mixed> $snapshot CommercialInputSnapshot result
     * @param array<string,mixed> $proposal
     * @return array<string,mixed>
     */
    public function compare(array $snapshot, array $proposal): array
    {
        $currency = $snapshot['currency_code'] ?? null;
        if (!in_array($currency, ['UYU', 'USD'], true)
            || ($proposal['currency_code'] ?? null) !== $currency) {
            throw new InvalidArgumentException('Currency mismatch or unsupported currency; conversion must be explicit.');
        }

        if (!isset($snapshot['acquisition_cost_minor']) || !is_int($snapshot['acquisition_cost_minor'])
            || $snapshot['acquisition_cost_minor'] < 0) {
            return [
                'status' => 'insufficient_data',
                'reasons' => ['acquisition_cost_missing'],
                'scenarios' => [],
                'recommended_kind' => null,
            ];
        }

        if (!isset($proposal['scenarios']) || !is_array($proposal['scenarios'])
            || count($proposal['scenarios']) !== 3) {
            throw new InvalidArgumentException('Exactly three explicit scenarios are required.');
        }

        $rows = [];
        foreach ($proposal['scenarios'] as $row) {
            if (!is_array($row) || !isset($row['kind']) || !is_string($row['kind'])) {
                throw new InvalidArgumentException('Malformed scenario.');
            }
            $kind = $row['kind'];
            if (isset($rows[$kind])) {
                throw new InvalidArgumentException('Duplicate scenario kind.');
            }

            if (!array_key_exists('gross_sale_minor', $row) || !array_key_exists('economic_extra_cost_minor', $row)
                || !array_key_exists('incremental_cash_outlay_minor', $row)
                || !array_key_exists('sale_expenses_minor', $row)) {
                throw new InvalidArgumentException('Explicit estimates required; no automatic market price is assumed.');
            }

            $rows[$kind] = $this->calculator->calculate([
                'kind' => $kind,
                'gross_sale_minor' => $row['gross_sale_minor'],
                'acquisition_cost_minor' => $snapshot['acquisition_cost_minor'],
                'economic_extra_cost_minor' => $row['economic_extra_cost_minor']
                    + ($snapshot['installed_parts_cost_minor'] ?? 0),
                'incremental_cash_outlay_minor' => $row['incremental_cash_outlay_minor'],
                'sale_expenses_minor' => $row['sale_expenses_minor'],
                'expected_days_to_cash' => $row['expected_days_to_cash'] ?? null,
            ]);
        }

        if (array_diff(['sell_as_is', 'refurbish', 'dismantle'], array_keys($rows))) {
            throw new InvalidArgumentException('Missing required scenario kind.');
        }

        $warnings = [];
        if (($snapshot['technical_evaluation'] ?? null) === null) {
            $warnings[] = 'technical_evaluation_missing';
        }
        if (($snapshot['is_consigned'] ?? false) === true) {
            $warnings[] = 'consignment_terms_must_be_reviewed';
        }
        if (($snapshot['can_plan_whole_device_sale'] ?? false) !== true) {
            $warnings[] = 'whole_device_sale_not_eligible';
        }

        // A mathematical winner without evidence would be misleading.
        // Risk, liquidity and sales likelihood have yet to be scored.
        return [
            'status' => 'comparison_only',
            'currency_code' => $currency,
            'inventory_item_id' => $snapshot['inventory_item_id'],
            'scenarios' => array_values($rows),
            'warnings' => $warnings,
            'recommended_kind' => null,
        ];
    }
}
