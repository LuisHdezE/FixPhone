<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Customer\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class CustomerDirectoryController extends Controller
{
    private const WRITABLE = ['full_name', 'email', 'phone', 'relationship_state', 'notes'];

    public function index(): JsonResponse
    {
        $customers = Customer::query()->orderBy('full_name')->get();

        // Orders and monetary totals are not yet backed by the operational
        // order system. Null explicitly means "not available", not zero.
        return response()->json(['data' => $customers->map(
            fn (Customer $customer): array => $this->representation($customer)
        )]);
    }

    public function show(string $id): JsonResponse
    {
        return response()->json(['data' => $this->representation(Customer::query()->findOrFail($id))]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->rejectUnexpected($request);
        $validated = $this->validated($request);
        $customer = DB::transaction(function () use ($request, $validated): Customer {
            $customer = Customer::query()->create($validated);
            $this->audit($request, $customer, 'customers.created', 'create', array_keys($validated));
            return $customer;
        });

        return response()->json(['data' => $this->representation($customer)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $this->rejectUnexpected($request);
        $customer = DB::transaction(function () use ($request, $id): Customer {
            $customer = Customer::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            $validated = $this->validated($request, $customer->id);
            $before = $customer->only(self::WRITABLE);
            $customer->fill($validated);
            if ($customer->isDirty()) {
                $changed = array_keys(array_filter(
                    $validated,
                    static fn ($value, $field): bool => $value !== ($before[$field] ?? null),
                    ARRAY_FILTER_USE_BOTH
                ));
                $customer->save();
                $this->audit($request, $customer, 'customers.updated', 'update', $changed);
            }
            return $customer;
        });

        return response()->json(['data' => $this->representation($customer)]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        DB::transaction(function () use ($request, $id): void {
            $customer = Customer::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            // Do not detach financial or operational history. Future orders and
            // repair processes may reference this contact via customer_id.
            foreach (['orders', 'repair_quotes', 'device_sale_records'] as $table) {
                if (Schema::hasTable($table) && Schema::hasColumn($table, 'customer_id')
                    && DB::table($table)->where('customer_id', $id)->exists()) {
                    abort(409, 'El cliente tiene operaciones asociadas. No se puede eliminar su ficha.');
                }
            }

            $customer->delete();
            $this->audit($request, $customer, 'customers.archived', 'delete', []);
        });

        return response()->json(['message' => 'Cliente archivado. Se conserva su historial de auditoría.']);
    }

    private function validated(Request $request, ?string $id = null): array
    {
        $validated = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('crm_customers', 'email')->ignore($id)],
            'phone' => ['nullable', 'string', 'max:60'],
            'relationship_state' => ['required', Rule::in(['active', 'attention', 'inactive'])],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);

        foreach (['full_name', 'email', 'phone', 'notes'] as $field) {
            if (isset($validated[$field])) {
                $validated[$field] = trim($validated[$field]);
                if ($field !== 'full_name' && $validated[$field] === '') {
                    $validated[$field] = null;
                }
            }
        }

        if (empty($validated['full_name'])) {
            throw ValidationException::withMessages(['full_name' => 'Ingresá el nombre del cliente.']);
        }
        if (empty($validated['phone']) && empty($validated['email'])) {
            throw ValidationException::withMessages(['phone' => 'Ingresá un teléfono o un correo para contactar al cliente.']);
        }
        if (!empty($validated['email'])) {
            $validated['email'] = Str::lower($validated['email']);
        }

        return $validated;
    }

    private function rejectUnexpected(Request $request): void
    {
        $unexpected = array_diff(array_keys($request->all()), self::WRITABLE);
        if ($unexpected) {
            throw ValidationException::withMessages(['customer' => 'Campos no editables: '.implode(', ', $unexpected)]);
        }
    }

    private function representation(Customer $customer): array
    {
        return [
            'id' => $customer->id,
            'full_name' => $customer->full_name,
            'email' => $customer->email,
            'phone' => $customer->phone,
            'relationship_state' => $customer->relationship_state,
            'notes' => $customer->notes,
            'created_at' => $customer->created_at?->toIso8601String(),
            'order_count' => null,
            'last_order_at' => null,
            'lifetime_value_minor' => null,
        ];
    }

    private function audit(Request $request, Customer $customer, string $event, string $action, array $fields): void
    {
        DB::table('audit_events')->insert([
            'id' => (string) Str::ulid(),
            'event_type' => $event,
            'action' => $action,
            'entity_type' => 'Customer',
            'entity_id' => $customer->id,
            'actor_type' => 'user',
            'actor_id' => (string) $request->user()->getAuthIdentifier(),
            'metadata' => json_encode(['changed_fields' => $fields]),
            'occurred_at' => now(),
        ]);
    }
}
