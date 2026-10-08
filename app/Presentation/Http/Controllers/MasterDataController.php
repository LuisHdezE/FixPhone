<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\MasterData\MasterDataEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Str;

final class MasterDataController extends Controller
{
    private const KINDS = [
        'brands',
        'deviceModels',
        'categories',
        'colors',
        'storageCapacities',
        'ramCapacities',
        'conditions',
        'sparePartTypes',
    ];

    public function catalog(): JsonResponse
    {
        $entries = MasterDataEntry::query()
            ->orderBy('kind')
            ->get()
            ->groupBy('kind');

        $catalog = [];
        foreach (self::KINDS as $kind) {
            $catalog[$kind] = ($entries->get($kind) ?? collect())
                ->map(fn (MasterDataEntry $entry) => $entry->payload)
                ->sortBy(fn (array $item) => [$item['sortOrder'] ?? 0, $item['name'] ?? $item['label'] ?? ''])
                ->values()
                ->all();
        }

        return response()->json(['data' => $catalog]);
    }

    public function index(string $kind): JsonResponse
    {
        $this->assertKind($kind);

        $items = MasterDataEntry::query()
            ->where('kind', $kind)
            ->get()
            ->map(fn (MasterDataEntry $entry) => $entry->payload)
            ->sortBy(fn (array $item) => [$item['sortOrder'] ?? 0, $item['name'] ?? $item['label'] ?? ''])
            ->values();

        return response()->json(['data' => $items]);
    }

    public function store(Request $request, string $kind): JsonResponse
    {
        $this->assertKind($kind);
        $payload = $this->validatedPayload($request, false);

        $id = trim((string) ($payload['id'] ?? ''));
        if ($id === '') {
            $id = $this->generatedId($kind);
        }

        if (MasterDataEntry::query()->whereKey($id)->exists()) {
            abort(409, 'Master data id already exists.');
        }

        $payload['id'] = $id;
        $entry = MasterDataEntry::query()->create([
            'id' => $id,
            'kind' => $kind,
            'payload' => $payload,
        ]);

        return response()->json($entry->payload, 201);
    }

    public function update(Request $request, string $kind, string $id): JsonResponse
    {
        $this->assertKind($kind);

        $entry = MasterDataEntry::query()
            ->where('kind', $kind)
            ->whereKey($id)
            ->firstOrFail();

        $payload = array_replace($entry->payload, $this->validatedPayload($request, true));
        $payload['id'] = $id;

        $entry->update(['payload' => $payload]);

        return response()->json($entry->fresh()->payload);
    }

    public function destroy(string $kind, string $id): JsonResponse
    {
        $this->assertKind($kind);

        $entry = MasterDataEntry::query()
            ->where('kind', $kind)
            ->whereKey($id)
            ->firstOrFail();

        $entry->delete();

        return response()->json(['deleted' => true, 'id' => $id]);
    }

    private function assertKind(string $kind): void
    {
        abort_unless(in_array($kind, self::KINDS, true), 404, 'Unknown master data kind.');
    }

    private function validatedPayload(Request $request, bool $partial): array
    {
        $rules = [
            'id' => ['sometimes', 'string', 'max:120'],
            'name' => ['sometimes', 'string', 'max:160'],
            'label' => ['sometimes', 'string', 'max:160'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:180'],
            'logo' => ['sometimes', 'nullable', 'string', 'max:500'],
            'brandId' => ['sometimes', 'nullable', 'string', 'max:120'],
            'modelCode' => ['sometimes', 'nullable', 'string', 'max:120'],
            'parentId' => ['sometimes', 'nullable', 'string', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'imageOrIcon' => ['sometimes', 'nullable', 'string', 'max:500'],
            'showInStorefront' => ['sometimes', 'boolean'],
            'hex' => ['sometimes', 'nullable', 'string', 'max:20'],
            'valueGb' => ['sometimes', 'integer', 'min:0', 'max:65536'],
            'grade' => ['sometimes', 'nullable', 'string', 'max:40'],
            'active' => ['sometimes', 'boolean'],
            'sortOrder' => ['sometimes', 'integer', 'min:-100000', 'max:100000'],
        ];

        $payload = $request->validate($rules);

        if (!$partial && !isset($payload['name']) && !isset($payload['label'])) {
            abort(422, 'Master data item requires name or label.');
        }

        return $payload;
    }

    private function generatedId(string $kind): string
    {
        $prefix = match ($kind) {
            'brands' => 'brand',
            'deviceModels' => 'model',
            'categories' => 'cat',
            'colors' => 'color',
            'storageCapacities' => 'storage',
            'ramCapacities' => 'ram',
            'conditions' => 'condition',
            'sparePartTypes' => 'part',
        };

        return $prefix.'-'.Str::lower((string) Str::ulid());
    }
}
