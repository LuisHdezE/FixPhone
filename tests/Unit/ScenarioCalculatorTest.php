<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Domain\CommercialDecision\ScenarioCalculator;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class ScenarioCalculatorTest extends TestCase
{
    public function test_direct_sale_calculates_profit_margin_and_cash_separately(): void
    {
        $result = (new ScenarioCalculator())->calculate([
            'kind' => 'sell_as_is',
            'gross_sale_minor' => 335000,
            'acquisition_cost_minor' => 180000,
            'economic_extra_cost_minor' => 0,
            'incremental_cash_outlay_minor' => 0,
            'sale_expenses_minor' => 15000,
            'expected_days_to_cash' => 7,
        ]);

        self::assertSame(320000, $result['net_realization_minor']);
        self::assertSame(140000, $result['economic_profit_minor']);
        self::assertSame(41.79, $result['margin_percent']);
        self::assertSame(320000, $result['cash_after_additional_outlay_minor']);
        self::assertSame(7, $result['expected_days_to_cash']);
    }

    public function test_own_spare_part_counts_economic_cost_but_not_incremental_cash(): void
    {
        $result = (new ScenarioCalculator())->calculate([
            'kind' => 'refurbish',
            'gross_sale_minor' => 500000,
            'acquisition_cost_minor' => 180000,
            'economic_extra_cost_minor' => 100000,
            'incremental_cash_outlay_minor' => 0,
            'sale_expenses_minor' => 20000,
        ]);
        self::assertSame(200000, $result['economic_profit_minor']);
        self::assertSame(480000, $result['cash_after_additional_outlay_minor']);
        self::assertNull($result['expected_days_to_cash']);
    }

    public function test_zero_sale_has_null_margin_and_may_lose_money(): void
    {
        $result = (new ScenarioCalculator())->calculate([
            'kind' => 'dismantle',
            'gross_sale_minor' => 0,
            'acquisition_cost_minor' => 10000,
            'economic_extra_cost_minor' => 0,
            'incremental_cash_outlay_minor' => 0,
            'sale_expenses_minor' => 0,
        ]);
        self::assertNull($result['margin_percent']);
        self::assertSame(-10000, $result['economic_profit_minor']);
    }

    public function test_negative_cost_is_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        (new ScenarioCalculator())->calculate([
            'kind' => 'sell_as_is',
            'gross_sale_minor' => 50000,
            'acquisition_cost_minor' => -1,
            'economic_extra_cost_minor' => 0,
            'incremental_cash_outlay_minor' => 0,
            'sale_expenses_minor' => 0,
        ]);
    }

    public function test_invalid_scenario_is_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        (new ScenarioCalculator())->calculate([
            'kind' => 'sell_phone_and_parts',
            'gross_sale_minor' => 50000,
            'acquisition_cost_minor' => 0,
            'economic_extra_cost_minor' => 0,
            'incremental_cash_outlay_minor' => 0,
            'sale_expenses_minor' => 0,
        ]);
    }
}
