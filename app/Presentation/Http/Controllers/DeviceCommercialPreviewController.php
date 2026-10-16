<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers;

use App\Application\CommercialDecision\CommercialInputSnapshot;
use App\Application\CommercialDecision\CompareCommercialScenarios;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use InvalidArgumentException;

final class DeviceCommercialPreviewController extends Controller
{
    /**
     * Read-only commercial comparison. Does not persist or route devices.
     */
    public function __invoke(
        Request $request,
        string $id,
        CommercialInputSnapshot $snapshotReader,
        CompareCommercialScenarios $comparator,
    ): JsonResponse {
        $data = $request->validate([
            'currency_code' => ['required', Rule::in(['UYU', 'USD'])],
            'scenarios' => ['required', 'array', 'size:3'],
            'scenarios.*' => ['required', 'array:kind,gross_sale_minor,economic_extra_cost_minor,incremental_cash_outlay_minor,sale_expenses_minor,expected_days_to_cash'],
            'scenarios.*.kind' => ['required', Rule::in(['sell_as_is', 'refurbish', 'dismantle']), 'distinct'],
            'scenarios.*.gross_sale_minor' => ['required', 'integer', 'between:0,100000000000'],
            'scenarios.*.economic_extra_cost_minor' => ['required', 'integer', 'between:0,100000000000'],
            'scenarios.*.incremental_cash_outlay_minor' => ['required', 'integer', 'between:0,100000000000'],
            'scenarios.*.sale_expenses_minor' => ['required', 'integer', 'between:0,100000000000'],
            'scenarios.*.expected_days_to_cash' => ['sometimes', 'nullable', 'integer', 'between:0,36500'],
        ]);

        $snapshot = $snapshotReader->forDevice($id);
        try {
            $result = $comparator->compare($snapshot, $data);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422)
                ->header('Cache-Control', 'no-store');
        }

        return response()->json(['data' => $result])
            ->header('Cache-Control', 'no-store');
    }
}
