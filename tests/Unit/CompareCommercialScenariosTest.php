<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Application\CommercialDecision\CompareCommercialScenarios;
use App\Domain\CommercialDecision\ScenarioCalculator;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class CompareCommercialScenariosTest extends TestCase
{
    private function service(): CompareCommercialScenarios
    {
        return new CompareCommercialScenarios(new ScenarioCalculator());
    }

    private function proposal(): array
    {
        return [
            'currency_code' => 'UYU',
            'scenarios' => [
                ['kind' => 'sell_as_is', 'gross_sale_minor' => 300000, 'economic_extra_cost_minor' => 0, 'incremental_cash_outlay_minor' => 0, 'sale_expenses_minor' => 10000],
                ['kind' => 'refurbish', 'gross_sale_minor' => 500000, 'economic_extra_cost_minor' => 100000, 'incremental_cash_outlay_minor' => 50000, 'sale_expenses_minor' => 20000],
                ['kind' => 'dismantle', 'gross_sale_minor' => 400000, 'economic_extra_cost_minor' => 20000, 'incremental_cash_outlay_minor' => 0, 'sale_expenses_minor' => 10000],
            ],
        ];
    }

    private function snapshot(): array
    {
        return [
            'inventory_item_id' => 'example',
            'currency_code' => 'UYU',
            'acquisition_cost_minor' => 180000,
            'installed_parts_cost_minor' => 30000,
            'technical_evaluation' => ['id' => 'evaluation'],
            'can_plan_whole_device_sale' => true,
            'is_consigned' => false,
        ];
    }

    public function test_three_scenarios_are_computed_without_auto_recommendation(): void
    {
        $result = $this->service()->compare($this->snapshot(), $this->proposal());
        self::assertSame('comparison_only', $result['status']);
        self::assertCount(3, $result['scenarios']);
        self::assertSame(80000, $result['scenarios'][0]['economic_profit_minor']);
        self::assertSame(170000, $result['scenarios'][1]['economic_profit_minor']);
        self::assertNull($result['recommended_kind']);
    }

    public function test_unknown_acquisition_cost_prevents_fake_profit(): void
    {
        $snapshot = $this->snapshot();
        $snapshot['acquisition_cost_minor'] = null;
        self::assertSame('insufficient_data', $this->service()->compare($snapshot, $this->proposal())['status']);
    }

    public function test_currency_mismatch_fails_closed(): void
    {
        $proposal = $this->proposal();
        $proposal['currency_code'] = 'USD';
        $this->expectException(InvalidArgumentException::class);
        $this->service()->compare($this->snapshot(), $proposal);
    }

    public function test_missing_price_does_not_default_to_zero(): void
    {
        $proposal = $this->proposal();
        unset($proposal['scenarios'][0]['gross_sale_minor']);
        $this->expectException(InvalidArgumentException::class);
        $this->service()->compare($this->snapshot(), $proposal);
    }

    public function test_consignment_and_unavailable_sale_are_flagged(): void
    {
        $snapshot = $this->snapshot();
        $snapshot['is_consigned'] = true;
        $snapshot['can_plan_whole_device_sale'] = false;
        $result = $this->service()->compare($snapshot, $this->proposal());
        self::assertContains('consignment_terms_must_be_reviewed', $result['warnings']);
        self::assertContains('whole_device_sale_not_eligible', $result['warnings']);
    }
}
