<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class DeviceTechnicalEvaluationController extends Controller
{
    /** Stable identifiers shared with the eight checks on the device screen. */
    private const CHECK_KEYS = [
        'display_touch', 'housing', 'moisture', 'battery_charging',
        'cameras', 'audio_microphones', 'connectivity', 'biometrics',
    ];

    public function index(string $id): JsonResponse
    {
        $this->device($id);
        $rows = DB::table('device_technical_evaluations')
            ->where('inventory_item_id', $id)
            ->orderByDesc('revision')
            ->get();

        return response()->json(['data' => $rows->map(fn (object $row): array => $this->summary($row))]);
    }

    public function store(Request $request, string $id): JsonResponse
    {
        $data = $this->validated($request);
        $result = DB::transaction(function () use ($request, $id, $data): object {
            // Serializes technical revisions per device without modifying inventory.
            $device = InventoryItem::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            $this->assertDevice($device);
            if (in_array($device->operational_status, ['sold', 'vendido'], true)) {
                abort(409, 'No se puede registrar un nuevo diagnóstico sobre un equipo vendido.');
            }
            if (DB::table('device_technical_evaluations')->where('request_id', $data['request_id'])->exists()) {
                abort(409, 'Esta evaluación ya fue registrada. Actualizá el historial antes de intentar otra.');
            }

            $checks = collect($data['checks'])->keyBy('key');
            $results = $checks->pluck('result');
            $overall = $results->contains('fault') ? 'with_faults'
                : (($results->contains('not_tested') || !$results->contains('ok')) ? 'partial' : 'passed');
            $revision = (int) DB::table('device_technical_evaluations')
                ->where('inventory_item_id', $device->id)->max('revision') + 1;
            $evaluationId = (string) Str::ulid();
            $now = now();

            DB::table('device_technical_evaluations')->insert([
                'id' => $evaluationId,
                'inventory_item_id' => $device->id,
                'revision' => $revision,
                'request_id' => $data['request_id'],
                'device_sku_snapshot' => $device->sku,
                'device_title_snapshot' => $device->title,
                'overall_result' => $overall,
                'notes' => isset($data['notes']) && trim($data['notes']) !== '' ? trim($data['notes']) : null,
                'evaluated_by_actor_id' => (string) $request->user()->getAuthIdentifier(),
                'technician_name_snapshot' => (string) $request->user()->name,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            foreach (self::CHECK_KEYS as $key) {
                $check = $checks->get($key);
                DB::table('device_technical_checks')->insert([
                    'id' => (string) Str::ulid(),
                    'evaluation_id' => $evaluationId,
                    'check_key' => $key,
                    'result' => $check['result'],
                    'notes' => isset($check['notes']) && trim($check['notes']) !== '' ? trim($check['notes']) : null,
                ]);
            }

            DB::table('audit_events')->insert([
                'id' => (string) Str::ulid(),
                'event_type' => 'device.technical_evaluation_recorded',
                'action' => 'create',
                'entity_type' => 'DeviceTechnicalEvaluation',
                'entity_id' => $evaluationId,
                'actor_type' => 'user',
                'actor_id' => (string) $request->user()->getAuthIdentifier(),
                'correlation_id' => $request->attributes->get('correlation_id'),
                'metadata' => json_encode([
                    'inventory_item_id' => $device->id,
                    'revision' => $revision,
                    'overall_result' => $overall,
                ]),
                'occurred_at' => $now,
            ]);

            return DB::table('device_technical_evaluations')->where('id', $evaluationId)->firstOrFail();
        });

        return response()->json(['data' => $this->summary($result)], 201);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'request_id' => ['required', 'uuid'],
            'notes' => ['nullable', 'string', 'max:3000'],
            'checks' => ['required', 'array', 'size:8'],
            'checks.*' => ['required', 'array:key,result,notes'],
            'checks.*.key' => ['required', 'string', Rule::in(self::CHECK_KEYS), 'distinct:strict'],
            'checks.*.result' => ['required', 'string', Rule::in(['ok', 'fault', 'not_tested', 'not_applicable'])],
            'checks.*.notes' => ['nullable', 'string', 'max:800'],
        ]);

        if (array_diff(array_keys($request->all()), ['request_id', 'checks', 'notes'])) {
            throw ValidationException::withMessages(['evaluation' => 'Se recibieron campos no permitidos.']);
        }

        $keys = array_column($data['checks'], 'key');
        if (count(array_unique($keys)) !== count(self::CHECK_KEYS)
            || array_diff(self::CHECK_KEYS, $keys)) {
            throw ValidationException::withMessages(['checks' => 'Registrá cada una de las ocho pruebas una sola vez.']);
        }
        if (!collect($data['checks'])->contains(
            static fn (array $check): bool => in_array($check['result'], ['ok', 'fault'], true)
        )) {
            throw ValidationException::withMessages(['checks' => 'Registrá al menos una prueba comprobada como correcta o con falla.']);
        }
        return $data;
    }

    private function device(string $id): InventoryItem
    {
        $device = InventoryItem::query()->findOrFail($id);
        $this->assertDevice($device);
        return $device;
    }

    private function assertDevice(InventoryItem $device): void
    {
        if (!in_array($device->item_type, ['device', 'used_phone'], true)) {
            abort(422, 'La evaluación técnica solo admite dispositivos individuales.');
        }
    }

    private function summary(object $row): array
    {
        return [
            'id' => $row->id,
            'inventory_item_id' => $row->inventory_item_id,
            'revision' => (int) $row->revision,
            'device_sku_snapshot' => $row->device_sku_snapshot,
            'device_title_snapshot' => $row->device_title_snapshot,
            'overall_result' => $row->overall_result,
            'notes' => $row->notes,
            'technician_name' => $row->technician_name_snapshot,
            'created_at' => $row->created_at,
            'checks' => DB::table('device_technical_checks')
                ->where('evaluation_id', $row->id)
                ->get(['check_key', 'result', 'notes'])
                ->all(),
        ];
    }
}
