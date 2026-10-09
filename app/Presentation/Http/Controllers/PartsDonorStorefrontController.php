<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Valuation\PublishedPartsDonor;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;

final class PartsDonorStorefrontController extends Controller
{
    public function index(): JsonResponse
    {
        $items = PublishedPartsDonor::query()->with('inventoryItem')
            ->orderByDesc('updated_at')->limit(100)->get();
        return response()->json([
            'data' => $items->map(static fn ($valuation): array => PublishedPartsDonor::publicData($valuation)),
        ]);
    }

    public function show(string $id): JsonResponse
    {
        $valuation = PublishedPartsDonor::query()->findOrFail($id);
        return response()->json(['data' => PublishedPartsDonor::publicData($valuation)]);
    }
}
