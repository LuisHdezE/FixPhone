<?php

namespace App\Presentation\Http\Controllers;

use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;

final class OwnerBootstrapController
{
    public function __invoke(Request $request): JsonResponse
    {
        $secret = $request->header('X-Owner-Bootstrap-Key', '');
        $fingerprint = (string) config('fixphone_owner_bootstrap.sha256');
        $expiry = CarbonImmutable::parse((string) config('fixphone_owner_bootstrap.expires_at_utc'));

        // Do not expose whether the installation already has an owner to callers
        // who do not possess the one-time cryptographically random token.
        if (!is_string($secret)
            || !hash_equals($fingerprint, hash('sha256', $secret))
            || CarbonImmutable::now('UTC')->greaterThan($expiry)) {
            abort(404);
        }

        $data = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:10', 'max:255'],
        ])->validate();

        $owner = DB::transaction(function () use ($data): array {
            // Serialize bootstrap requests against the owner role row.
            $ownerRole = DB::table('roles')->where('slug', 'owner')->lockForUpdate()->first();
            if ($ownerRole === null) {
                abort(503, 'La configuración de permisos no está preparada.');
            }
            if (DB::table('user_roles')->where('role_slug', 'owner')->exists()) {
                abort(409, 'La cuenta propietaria ya está inicializada.');
            }

            $normalizedEmail = mb_strtolower(trim($data['email']));
            if (DB::table('users')->where('email', $normalizedEmail)->exists()) {
                abort(409, 'La cuenta de correo ya existe.');
            }

            $id = (string) Str::ulid();
            $timestamp = now();
            DB::table('users')->insert([
                'id' => $id,
                'name' => trim($data['name']),
                'email' => $normalizedEmail,
                'password' => Hash::make($data['password']),
                'role' => 'owner',
                'active' => true,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ]);
            DB::table('user_roles')->insert(['user_id' => $id, 'role_slug' => 'owner']);

            DB::table('audit_events')->insert([
                'id' => (string) Str::ulid(),
                'event_type' => 'ACCESS.OWNER_BOOTSTRAPPED',
                'action' => 'create',
                'entity_type' => 'User',
                'entity_id' => $id,
                'actor_type' => 'system',
                'actor_id' => null,
                'metadata' => json_encode(['bootstrap' => 'one_time', 'role' => 'owner']),
                'occurred_at' => $timestamp,
            ]);
            return ['id' => $id, 'name' => trim($data['name']), 'email' => $normalizedEmail];
        });

        return response()->json(['data' => $owner], 201);
    }
}
