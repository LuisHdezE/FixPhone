<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Inventory\Consignor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Str;

final class ConsignorsController extends Controller
{
    public function index(): JsonResponse
    {
        $consignors = Consignor::query()->orderByDesc('created_at')->get();
        return response()->json(['data' => $consignors]);
    }

    public function show(string $id): JsonResponse
    {
        $consignor = Consignor::query()->findOrFail($id);
        return response()->json(['data' => $consignor]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'document_number' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'string', 'email', 'max:255'],
        ]);

        $consignor = Consignor::create([
            'id' => (string) Str::ulid(),
            ...$validated,
        ]);

        return response()->json(['data' => $consignor], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $consignor = Consignor::query()->findOrFail($id);

        $validated = $request->validate([
            'full_name' => ['sometimes', 'required', 'string', 'max:255'],
            'document_number' => ['sometimes', 'nullable', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:255'],
            'email' => ['sometimes', 'nullable', 'string', 'email', 'max:255'],
        ]);

        $consignor->update($validated);

        return response()->json(['data' => $consignor]);
    }
}
