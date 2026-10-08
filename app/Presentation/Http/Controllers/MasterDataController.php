<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\MasterData\MasterDataEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

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

    /**
     * Kinds whose items reference a parent of the same kind through `parentId`.
     */
    private const HIERARCHICAL_KINDS = [
        'categories',
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

        $this->assertRelationships($kind, $id, $payload, true);

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

        $changes = $this->validatedPayload($request, true);
        $this->assertRelationships($kind, $id, $changes, false);

        $payload = array_replace($entry->payload, $changes);
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

        $this->assertDeletable($kind, $id);

        $entry->delete();

        return response()->json(['deleted' => true, 'id' => $id]);
    }

    private function assertKind(string $kind): void
    {
        abort_unless(in_array($kind, self::KINDS, true), 404, 'Unknown master data kind.');
    }

    /**
     * Validates references to other master data items.
     *
     * On create the full payload is checked; on update only the fields sent in
     * the request are checked, so legacy data does not block unrelated edits.
     */
    private function assertRelationships(string $kind, string $id, array $payload, bool $creating): void
    {
        $errors = [];

        if ($kind === 'deviceModels' && ($creating || array_key_exists('brandId', $payload))) {
            $brandId = trim((string) ($payload['brandId'] ?? ''));

            if ($brandId === '') {
                $errors['brandId'] = 'Device model requires a brandId.';
            } elseif (!$this->entryExists('brands', $brandId)) {
                $errors['brandId'] = 'Selected brand does not exist.';
            }
        }

        if (in_array($kind, self::HIERARCHICAL_KINDS, true) && array_key_exists('parentId', $payload)) {
            $parentId = trim((string) ($payload['parentId'] ?? ''));

            if ($parentId !== '') {
                if ($parentId === $id) {
                    $errors['parentId'] = 'An item cannot be its own parent.';
                } elseif (!$this->entryExists($kind, $parentId)) {
                    $errors['parentId'] = 'Selected parent does not exist.';
                }
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    /**
     * Blocks deletions that would leave orphaned references.
     */
    private function assertDeletable(string $kind, string $id): void
    {
        if ($kind === 'brands' && $this->hasDependents('deviceModels', 'brandId', $id)) {
            abort(409, 'Brand has associated device models and cannot be deleted.');
        }

        if (in_array($kind, self::HIERARCHICAL_KINDS, true) && $this->hasDependents($kind, 'parentId', $id)) {
            abort(409, 'Item has child items and cannot be deleted.');
        }
    }

    private function entryExists(string $kind, string $id): bool
    {
        return MasterDataEntry::query()
            ->where('kind', $kind)
            ->whereKey($id)
            ->exists();
    }

    /**
     * Filters in PHP to stay portable across SQLite (tests) and MySQL (cPanel).
     */
    private function hasDependents(string $kind, string $field, string $id): bool
    {
        return MasterDataEntry::query()
            ->where('kind', $kind)
            ->get()
            ->contains(fn (MasterDataEntry $entry) => ($entry->payload[$field] ?? null) === $id);
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
