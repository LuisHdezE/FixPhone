<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\RepairQuotes\RepairQuote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class RepairQuoteController extends Controller
{
    private const MARKUP_PERCENT = 20;

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => RepairQuote::query()->latest('created_at')->orderByDesc('id')->limit(200)->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'customer_name' => ['nullable', 'string', 'max:160'],
            'customer_contact' => ['nullable', 'string', 'max:160'],
            'device_description' => ['nullable', 'string', 'max:240'],
            'device_tier' => ['required', Rule::in(['baja', 'media', 'alta'])],
            'services' => ['required', 'array', 'min:1', 'max:30'],
            'services.*.name' => ['required', 'string', 'max:160'],
            'services.*.price_minor' => ['required', 'integer', 'min:0', 'max:100000000'],
            'parts' => ['present', 'array', 'max:100'],
            'parts.*.name' => ['required', 'string', 'max:160'],
            'parts.*.unit_cost_minor' => ['required', 'integer', 'min:0', 'max:100000000'],
            'parts.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
            'courier_minor' => ['required', 'integer', 'min:0', 'max:100000000'],
            'discount_minor' => ['required', 'integer', 'min:0', 'max:100000000'],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);

        $services = array_map(
            static fn(array $line): array => [
                'name' => trim($line['name']), 'price_minor' => $line['price_minor'],
            ],
            $data['services'],
        );
        $parts = array_map(
            static fn(array $line): array => [
                'name' => trim($line['name']), 'unit_cost_minor' => $line['unit_cost_minor'],
                'quantity' => $line['quantity'],
            ],
            $data['parts'],
        );

        $serviceSubtotal = array_sum(array_column($services, 'price_minor'));
        $partsBase = array_reduce(
            $parts,
            static fn(int $total, array $line): int => $total + ($line['unit_cost_minor'] * $line['quantity']),
            0,
        );
        $partsTotal = intdiv($partsBase * (100 + self::MARKUP_PERCENT) + 50, 100);
        $beforeDiscount = $serviceSubtotal + $partsTotal + $data['courier_minor'];
        if ($data['discount_minor'] > $beforeDiscount) {
            throw ValidationException::withMessages([
                'discount_minor' => 'El descuento no puede superar el total antes de descontar.',
            ]);
        }

        $quote = DB::transaction(function () use ($request, $data, $services, $parts, $serviceSubtotal, $partsBase, $partsTotal, $beforeDiscount): RepairQuote {
            $quote = RepairQuote::query()->create([
                'customer_name' => $data['customer_name'] ?? null,
                'customer_contact' => $data['customer_contact'] ?? null,
                'device_description' => $data['device_description'] ?? null,
                'device_tier' => $data['device_tier'],
                'services' => $services,
                'parts' => $parts,
                'parts_markup_percent' => self::MARKUP_PERCENT,
                'services_subtotal_minor' => $serviceSubtotal,
                'parts_base_minor' => $partsBase,
                'parts_total_minor' => $partsTotal,
                'courier_minor' => $data['courier_minor'],
                'discount_minor' => $data['discount_minor'],
                'total_minor' => $beforeDiscount - $data['discount_minor'],
                'currency_code' => 'UYU',
                'notes' => $data['notes'] ?? null,
                'created_by' => (string)$request->user()->getAuthIdentifier(),
            ]);
            DB::table('audit_events')->insert([
                'id' => (string)Str::ulid(),
                'event_type' => 'REPAIR_QUOTE.CREATED',
                'action' => 'create',
                'entity_type' => 'RepairQuote',
                'entity_id' => $quote->id,
                'actor_type' => 'user',
                'actor_id' => (string)$request->user()->getAuthIdentifier(),
                'correlation_id' => $request->attributes->get('correlation_id'),
                'metadata' => json_encode([
                    'total_minor' => $quote->total_minor,
                    'currency_code' => 'UYU',
                    'service_count' => count($services),
                    'part_count' => count($parts),
                ]),
                'occurred_at' => now(),
            ]);
            return $quote;
        });

        return response()->json(['data' => $quote], 201);
    }
}
