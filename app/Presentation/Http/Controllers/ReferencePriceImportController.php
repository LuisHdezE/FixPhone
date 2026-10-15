<?php

namespace App\Presentation\Http\Controllers;

use App\Application\ReferencePrices\ReferencePriceCsvParser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ReferencePriceImportController extends Controller
{
    public function __construct(private readonly ReferencePriceCsvParser $parser) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => DB::table('reference_price_import_batches')
                ->where('status', 'committed')->orderByDesc('committed_at')->limit(25)
                ->get(['id', 'file_name', 'total_rows', 'inserted_rows', 'duplicate_rows',
                    'file_sha256', 'committed_at']),
        ])->header('Cache-Control', 'no-store');
    }

    public function preview(Request $request): JsonResponse
    {
        $data = $request->validate(['file' => ['required', 'file', 'max:1024']]);
        $file = $data['file'];
        $result = $this->parser->parse($file);
        if (!$result['valid']) {
            return response()->json([
                'valid' => false, 'summary' => $result['summary'],
                'errors' => $result['errors'], 'preview' => $result['preview'],
                'batch_id' => null,
            ])->header('Cache-Control', 'no-store');
        }

        $filename = basename(str_replace('\\', '/', $file->getClientOriginalName()));
        $batchId = (string) Str::ulid();
        DB::table('reference_price_import_batches')->insert([
            'id' => $batchId,
            'file_name' => mb_substr($filename, 0, 180),
            'file_sha256' => hash_file('sha256', $file->getRealPath()),
            'created_by' => (string) $request->user()->getAuthIdentifier(),
            'status' => 'pending',
            'total_rows' => $result['summary']['total'],
            'validated_rows' => json_encode($result['rows'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'expires_at' => now()->addHour(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'valid' => true, 'summary' => $result['summary'],
            'errors' => [], 'preview' => $result['preview'],
            'batch_id' => $batchId, 'expires_at' => now()->addHour()->toIso8601String(),
        ])->header('Cache-Control', 'no-store');
    }

    public function confirm(Request $request, string $batchId): JsonResponse
    {
        abort_unless(Str::isUlid($batchId), 404);
        $actorId = (string) $request->user()->getAuthIdentifier();

        $result = DB::transaction(function () use ($request, $batchId, $actorId): array {
            $batch = DB::table('reference_price_import_batches')
                ->where('id', $batchId)->where('created_by', $actorId)->lockForUpdate()->first();
            abort_if($batch === null, 404, 'No existe esta vista previa.');
            if ($batch->status === 'committed') {
                return ['id' => $batchId, 'inserted' => $batch->inserted_rows,
                    'duplicate' => $batch->duplicate_rows, 'already_confirmed' => true];
            }
            abort_if($batch->status !== 'pending' || $batch->expires_at < now(),
                409, 'Esta vista previa expiró. Seleccioná de nuevo el archivo CSV.');

            $rows = json_decode($batch->validated_rows, true, 512, JSON_THROW_ON_ERROR);
            $inserted = 0;
            foreach (array_chunk($rows, 100) as $chunk) {
                $records = [];
                foreach ($chunk as $row) {
                    $records[] = [
                        'id' => (string) Str::ulid(),
                        'import_batch_id' => $batchId,
                        'row_sha256' => $row['row_sha256'],
                        'source' => $row['source'],
                        'source_country' => $row['source_country'],
                        'source_url' => $row['source_url'],
                        'observed_date' => $row['observed_date'],
                        'brand' => $row['brand'],
                        'model' => $row['model'],
                        'service_code' => $row['service_code'],
                        'service_name' => $row['service_name'],
                        'currency' => $row['currency'],
                        'price_minor' => $row['price_minor'],
                        'minor_digits' => $row['minor_digits'],
                        'tax_included' => $row['tax_included'],
                        'price_type' => $row['price_type'],
                        'notes' => $row['notes'],
                        'created_at' => now(), 'updated_at' => now(),
                    ];
                }
                $inserted += DB::table('reference_price_observations')->insertOrIgnore($records);
            }

            $duplicate = $batch->total_rows - $inserted;
            DB::table('reference_price_import_batches')->where('id', $batchId)->update([
                'status' => 'committed', 'validated_rows' => null,
                'inserted_rows' => $inserted, 'duplicate_rows' => $duplicate,
                'committed_at' => now(), 'updated_at' => now(),
            ]);

            DB::table('audit_events')->insert([
                'id' => (string) Str::ulid(),
                'event_type' => 'REFERENCE_PRICE_IMPORT.CONFIRMED',
                'action' => 'import',
                'entity_type' => 'ReferencePriceImportBatch',
                'entity_id' => $batchId,
                'actor_type' => 'user', 'actor_id' => $actorId,
                'correlation_id' => $request->attributes->get('correlation_id'),
                'metadata' => json_encode([
                    'file_sha256' => $batch->file_sha256,
                    'total' => $batch->total_rows, 'inserted' => $inserted, 'duplicate' => $duplicate,
                ]),
                'occurred_at' => now(),
            ]);

            return ['id' => $batchId, 'inserted' => $inserted,
                'duplicate' => $duplicate, 'already_confirmed' => false];
        });

        return response()->json(['data' => $result])->header('Cache-Control', 'no-store');
    }
}
