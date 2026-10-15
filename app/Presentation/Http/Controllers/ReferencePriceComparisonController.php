<?php

namespace App\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class ReferencePriceComparisonController extends Controller
{
    private const SERVICES = ['BATTERY', 'SCREEN', 'BACK_GLASS', 'CAMERA', 'OTHER_DAMAGE'];

    public function options(): JsonResponse
    {
        $referenceModels = DB::table('reference_price_observations')
            ->distinct()->orderBy('model')->limit(500)->pluck('model')->all();
        $ownModels = DB::table('own_repair_reference_prices')
            ->whereNull('archived_at')->distinct()->orderBy('model')->limit(500)->pluck('model')->all();

        $models = array_values(array_unique([...$referenceModels, ...$ownModels]));
        natcasesort($models);

        return response()->json([
            'data' => ['models' => array_values($models), 'services' => self::SERVICES],
        ])->header('Cache-Control', 'no-store');
    }

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'model' => ['required', 'string', 'max:160'],
            'service_code' => ['required', Rule::in(self::SERVICES)],
        ]);
        $model = $data['model'];
        $service = $data['service_code'];

        $observations = DB::table('reference_price_observations')
            ->where('model', $model)
            ->where('service_code', $service)
            ->orderByDesc('observed_date')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(500)
            ->get(['source', 'source_country', 'source_url', 'observed_date',
                'model', 'service_code', 'service_name', 'currency',
                'price_minor', 'minor_digits', 'tax_included', 'price_type', 'notes']);

        // Latest observation per individual service variant and market.
        // Never collapse different prices by service code alone.
        $seen = [];
        $references = [];
        foreach ($observations as $row) {
            $key = json_encode([
                $row->source, $row->source_country, $row->service_name,
                $row->currency, $row->price_type, $row->tax_included,
            ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
            if (isset($seen[$key])) continue;
            $seen[$key] = true;
            $references[] = [
                'source' => $row->source,
                'source_country' => $row->source_country,
                'source_url' => $row->source_url,
                'observed_date' => $row->observed_date,
                'model' => $row->model,
                'service_code' => $row->service_code,
                'service_name' => $row->service_name,
                'currency' => $row->currency,
                'price_amount' => $this->price($row->price_minor, $row->minor_digits),
                'tax_included' => $row->tax_included,
                'price_type' => $row->price_type,
                'notes' => $row->notes,
                'is_stale' => Carbon::parse($row->observed_date)->lt(now()->subDays(180)),
            ];
        }

        $own = DB::table('own_repair_reference_prices')
            ->where('model', $model)->where('service_code', $service)
            ->whereNull('archived_at')->orderBy('service_name')->orderBy('currency')
            ->get(['id', 'model', 'service_code', 'service_name', 'currency',
                'price_minor', 'notes', 'version', 'updated_at'])
            ->map(fn ($row): array => [
                'id' => $row->id, 'model' => $row->model,
                'service_code' => $row->service_code, 'service_name' => $row->service_name,
                'currency' => $row->currency,
                'price_amount' => $this->price($row->price_minor, 2),
                'notes' => $row->notes, 'version' => $row->version,
                'updated_at' => $row->updated_at,
            ])->all();

        return response()->json([
            'data' => [
                'references' => $references, 'own' => $own,
                'matching_policy' => 'same_model_and_service_category_only_no_verified_equivalence',
            ],
        ])->header('Cache-Control', 'no-store');
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'model' => ['required', 'string', 'max:160', 'regex:/^iPhone [^\\x00-\\x1F]+$/u'],
            'service_code' => ['required', Rule::in(self::SERVICES)],
            'service_name' => ['required', 'string', 'max:160'],
            'currency' => ['required', Rule::in(['UYU', 'USD'])],
            'price_amount' => ['required', 'string', 'regex:/^(?:0|[1-9][0-9]{0,7})\\.[0-9]{2}$/'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
        $values = $this->validatedFields($data);
        $actor = (string) $request->user()->getAuthIdentifier();

        $id = DB::transaction(function () use ($request, $values, $actor): string {
            $id = (string) Str::ulid();
            $inserted = DB::table('own_repair_reference_prices')->insertOrIgnore([
                'id' => $id, ...$values,
                'version' => 1, 'created_by' => $actor, 'updated_by' => $actor,
                'created_at' => now(), 'updated_at' => now(),
            ]);
            if ($inserted !== 1) {
                abort(409, 'Ya existe una tarifa propia para ese modelo, servicio, opción y moneda.');
            }
            $this->audit($request, $id, 'created', $values['model'], $values['service_code'], 1);
            return $id;
        });
        return response()->json(['data' => $this->getOwn($id)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'price_amount' => ['required', 'string', 'regex:/^(?:0|[1-9][0-9]{0,7})\\.[0-9]{2}$/'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'expected_version' => ['required', 'integer', 'min:1'],
            'model' => ['prohibited'], 'service_code' => ['prohibited'],
            'service_name' => ['prohibited'], 'currency' => ['prohibited'],
        ]);

        if ($this->toMinor($data['price_amount']) < 1) {
            throw ValidationException::withMessages(['price_amount' => 'El precio debe ser mayor que cero.']);
        }

        DB::transaction(function () use ($request, $id, $data): void {
            $row = DB::table('own_repair_reference_prices')->where('id', $id)
                ->lockForUpdate()->first();
            abort_if($row === null, 404);
            abort_if($row->archived_at !== null, 409, 'Esta tarifa está archivada.');
            abort_if((int) $row->version !== (int) $data['expected_version'], 409,
                'Esta tarifa cambió. Actualizá y volvé a intentar.');
            $version = (int) $row->version + 1;
            DB::table('own_repair_reference_prices')->where('id', $id)->update([
                'price_minor' => $this->toMinor($data['price_amount']),
                'notes' => $data['notes'] ?? null, 'version' => $version,
                'updated_by' => (string) $request->user()->getAuthIdentifier(),
                'updated_at' => now(),
            ]);
            $this->audit($request, $id, 'updated', $row->model, $row->service_code, $version);
        });

        return response()->json(['data' => $this->getOwn($id)]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $data = $request->validate(['expected_version' => ['required', 'integer', 'min:1']]);
        DB::transaction(function () use ($request, $id, $data): void {
            $row = DB::table('own_repair_reference_prices')->where('id', $id)
                ->lockForUpdate()->first();
            abort_if($row === null, 404);
            abort_if($row->archived_at !== null, 409, 'La tarifa ya está archivada.');
            abort_if((int) $row->version !== (int) $data['expected_version'], 409,
                'Esta tarifa cambió. Actualizá y volvé a intentar.');
            DB::table('own_repair_reference_prices')->where('id', $id)->update([
                'archived_at' => now(), 'version' => (int) $row->version + 1,
                'updated_by' => (string) $request->user()->getAuthIdentifier(),
                'updated_at' => now(),
            ]);
            $this->audit($request, $id, 'archived', $row->model, $row->service_code, (int) $row->version + 1);
        });
        return response()->json(['data' => ['archived' => true]]);
    }

    private function validatedFields(array $data): array
    {
        $data['model'] = trim($data['model']);
        $data['service_name'] = trim($data['service_name']);
        if ($data['model'] === '' || $data['service_name'] === '' || $this->toMinor($data['price_amount']) < 1) {
            throw ValidationException::withMessages(['price_amount' => 'El modelo, servicio e importe deben ser válidos y mayores que cero.']);
        }
        return [
            'model' => $data['model'],
            'service_code' => $data['service_code'],
            'service_name' => $data['service_name'],
            'currency' => $data['currency'],
            'price_minor' => $this->toMinor($data['price_amount']),
            'notes' => $data['notes'] ?? null,
        ];
    }

    private function toMinor(string $amount): int
    {
        [$whole, $decimal] = explode('.', $amount, 2);
        return (int) $whole * 100 + (int) $decimal;
    }

    private function price(int $minor, int $digits): string
    {
        if ($digits === 0) return (string) $minor;
        $factor = 10 ** $digits;
        return (string) intdiv($minor, $factor).'.'.str_pad((string) ($minor % $factor), $digits, '0', STR_PAD_LEFT);
    }

    private function getOwn(string $id): object
    {
        return DB::table('own_repair_reference_prices')->where('id', $id)
            ->first(['id', 'model', 'service_code', 'service_name', 'currency',
                'price_minor', 'notes', 'version', 'updated_at']);
    }

    private function audit(Request $request, string $id, string $action, string $model, string $service, int $version): void
    {
        DB::table('audit_events')->insert([
            'id' => (string) Str::ulid(),
            'event_type' => 'OWN_REPAIR_REFERENCE.'.strtoupper($action),
            'action' => $action,
            'entity_type' => 'OwnRepairReferencePrice',
            'entity_id' => $id,
            'actor_type' => 'user',
            'actor_id' => (string) $request->user()->getAuthIdentifier(),
            'correlation_id' => $request->attributes->get('correlation_id'),
            'metadata' => json_encode([
                'model' => $model, 'service_code' => $service, 'version' => $version,
            ]),
            'occurred_at' => now(),
        ]);
    }
}
