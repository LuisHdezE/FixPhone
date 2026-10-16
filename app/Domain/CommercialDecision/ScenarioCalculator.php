<?php

declare(strict_types=1);

namespace App\Domain\CommercialDecision;

use InvalidArgumentException;

/**
 * Pure, side-effect-free commercial scenario calculator.
 * Amounts are integer minor monetary units in a single currency.
 * All acquisition and economic costs are explicit to avoid hidden stock writes.
 */
final class ScenarioCalculator
{
    /**
     * @param array{kind:string,gross_sale_minor:int,acquisition_cost_minor:int,
     *  economic_extra_cost_minor:int,incremental_cash_outlay_minor:int,
     *  sale_expenses_minor:int,expected_days_to_cash?:int|null} $input
     * @return array<string, int|float|string|null>
     */
    public function calculate(array $input): array
    {
        $kinds = ['sell_as_is', 'refurbish', 'dismantle'];
        if (!isset($input['kind']) || !in_array($input['kind'], $kinds, true)) {
            throw new InvalidArgumentException('Unsupported commercial scenario.');
        }

        foreach ([
            'gross_sale_minor', 'acquisition_cost_minor',
            'economic_extra_cost_minor', 'incremental_cash_outlay_minor',
            'sale_expenses_minor',
        ] as $key) {
            if (!isset($input[$key]) || !is_int($input[$key]) || $input[$key] < 0 || $input[$key] > 100000000000) {
                throw new InvalidArgumentException("Invalid non-negative monetary amount: {$key}.");
            }
        }

        $days = $input['expected_days_to_cash'] ?? null;
        if ($days !== null && (!is_int($days) || $days < 0 || $days > 36500)) {
            throw new InvalidArgumentException('Invalid expected days to cash.');
        }

        $gross = $input['gross_sale_minor'];
        $expenses = $input['sale_expenses_minor'];
        $net = $gross - $expenses;
        $profit = $net - $input['acquisition_cost_minor'] - $input['economic_extra_cost_minor'];
        $cashAfterAdditionalOutlay = $net - $input['incremental_cash_outlay_minor'];

        return [
            'kind' => $input['kind'],
            'gross_sale_minor' => $gross,
            'net_realization_minor' => $net,
            'economic_profit_minor' => $profit,
            'margin_percent' => $gross > 0 ? round(100 * $profit / $gross, 2) : null,
            'incremental_cash_outlay_minor' => $input['incremental_cash_outlay_minor'],
            'cash_after_additional_outlay_minor' => $cashAfterAdditionalOutlay,
            'expected_days_to_cash' => $days,
        ];
    }
}
