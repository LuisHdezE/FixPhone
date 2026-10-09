<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Media\MediaStorageProfile;
use App\Infrastructure\Media\R2Presigner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class MediaStorageSettingsController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => MediaStorageProfile::query()->orderBy('name')->get()
                ->map(static fn (MediaStorageProfile $profile): array => $profile->safeSummary()),
            'environment' => config('app.env'),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $values = $request->validate($this->rules(false));
        $this->checkEndpoint($values);

        $profile = DB::transaction(function () use ($request, $values): MediaStorageProfile {
            $profile = MediaStorageProfile::query()->create(
                $this->safeFields($values) + $this->encryptedFields($values)
            );
            $this->audit($request, $profile, 'created');
            return $profile;
        });

        return response()->json(['data' => $profile->safeSummary()], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $profile = MediaStorageProfile::query()->findOrFail($id);
        $values = $request->validate($this->rules(true));
        if ($values === []) {
            throw ValidationException::withMessages(['profile' => 'No se recibieron cambios.']);
        }
        $this->checkEndpoint(array_merge([
            'provider' => $profile->provider,
            'endpoint_url' => $profile->endpoint_url,
        ], $values));

        DB::transaction(function () use ($request, $profile, $values): void {
            $changedDestination = array_intersect(
                array_keys($values),
                ['provider', 'bucket', 'endpoint_url', 'public_base_url',
                 'object_prefix', 'access_key_id', 'secret_access_key'],
            ) !== [];
            $profile->fill($this->safeFields($values) + $this->encryptedFields($values));
            if ($changedDestination) {
                // Verification belongs to these exact connection settings.
                $profile->verified_at = null;
                if ($profile->is_selected) {
                    // Never redirect future uploads to a changed destination silently.
                    $profile->is_selected = false;
                }
            }
            $profile->save();
            $this->audit($request, $profile, 'updated');
        });

        return response()->json(['data' => $profile->refresh()->safeSummary()]);
    }

    public function select(Request $request, string $id): JsonResponse
    {
        $selected = DB::transaction(function () use ($request, $id): MediaStorageProfile {
            // Lock the profile set while switching, so only one is selected.
            MediaStorageProfile::query()->orderBy('id')->lockForUpdate()->get();
            $profile = MediaStorageProfile::query()->findOrFail($id);
            if (!filled($profile->access_key_id_encrypted) ||
                !filled($profile->secret_access_key_encrypted) ||
                !filled($profile->public_base_url)) {
                throw ValidationException::withMessages([
                    'profile' => 'Completá las credenciales y la URL pública antes de seleccionar este perfil.',
                ]);
            }

            MediaStorageProfile::query()->where('is_selected', true)->update(['is_selected' => false]);
            $profile->is_selected = true;
            $profile->save();
            $this->audit($request, $profile, 'selected');
            return $profile;
        });

        return response()->json(['data' => $selected->safeSummary()]);
    }

    /**
     * Non-destructive connectivity check: a signed HEAD for a guaranteed-absent
     * object should return 404 with valid R2 credentials. We do not write data,
     * leak the presigned URL, or mark photo-upload verification complete.
     */
    public function testConnection(string $id, R2Presigner $signer): JsonResponse
    {
        $profile = MediaStorageProfile::query()->findOrFail($id);
        if (!filled($profile->access_key_id_encrypted) || !filled($profile->secret_access_key_encrypted)) {
            throw ValidationException::withMessages(['profile' => 'Guardá las credenciales R2 antes de probar la conexión.']);
        }

        $probe = trim($profile->object_prefix, '/').'/_connection_test/'.(string) Str::ulid().'.webp';
        $url = $signer->signedUrl(
            $profile->endpoint_url,
            $profile->bucket,
            ltrim($probe, '/'),
            Crypt::decryptString($profile->access_key_id_encrypted),
            Crypt::decryptString($profile->secret_access_key_encrypted),
            'HEAD',
            60,
        );

        try {
            $response = Http::timeout(10)->withoutRedirecting()->head($url);
        } catch (\Throwable) {
            throw ValidationException::withMessages([
                'profile' => 'El servidor de FixPhone no pudo comunicarse con la API de Cloudflare R2. Revisá conectividad y firewall del hosting.',
            ]);
        }

        if ($response->status() === 404) {
            return response()->json([
                'data' => [
                    'reachable' => true,
                    'detail' => 'La API R2 respondió al control de lectura firmado. La subida desde el navegador aún debe probarse por separado.',
                ],
            ])->header('Cache-Control', 'no-store');
        }

        throw ValidationException::withMessages([
            'profile' => match ($response->status()) {
                401, 403 => 'R2 rechazó el control firmado (HTTP '.$response->status().'). Revisá el endpoint, bucket y permisos del token.',
                429 => 'Cloudflare limitó temporalmente las solicitudes. Volvé a intentar en unos minutos.',
                default => 'R2 devolvió HTTP '.$response->status().' en la prueba de conexión. Revisá la configuración.',
            },
        ]);
    }

    private function rules(bool $partial): array
    {
        $required = $partial ? 'sometimes' : 'required';
        return [
            'name' => [$required, 'string', 'min:2', 'max:120'],
            'provider' => [$required, Rule::in(['r2'])],
            'bucket' => [$required, 'string', 'regex:/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/'],
            'endpoint_url' => [$required, 'url:https', 'max:2048'],
            'public_base_url' => ['sometimes', 'nullable', 'url:https', 'max:2048'],
            'object_prefix' => ['sometimes', 'string', 'max:160', 'regex:/^[a-zA-Z0-9][a-zA-Z0-9_\/-]*$/'],
            'access_key_id' => ['sometimes', 'nullable', 'string', 'min:8', 'max:512'],
            'secret_access_key' => ['sometimes', 'nullable', 'string', 'min:8', 'max:512'],
        ];
    }

    private function checkEndpoint(array $values): void
    {
        $url = $values['endpoint_url'] ?? '';
        $parts = parse_url($url);
        $host = strtolower($parts['host'] ?? '');

        // R2 S3 API endpoints are account-scoped, never full object or bucket URLs.
        // Restrict hosts to Cloudflare R2 to prevent an arbitrary internal URL being
        // used as a future signed-upload destination (SSRF / credential forwarding).
        if (!is_array($parts) ||
            ($parts['scheme'] ?? '') !== 'https' ||
            !preg_match('/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/D', $host) ||
            isset($parts['user']) || isset($parts['pass']) ||
            isset($parts['query']) || isset($parts['fragment']) ||
            isset($parts['port']) || ($parts['path'] ?? '') !== '') {
            throw ValidationException::withMessages([
                'endpoint_url' => 'Usá la URL HTTPS de la cuenta R2 sin incluir el nombre del bucket ni una ruta.',
            ]);
        }

        if (filled($values['public_base_url'] ?? null)) {
            $public = parse_url($values['public_base_url']);
            $hostname = strtolower($public['host'] ?? '');
            if (!is_array($public) || ($public['scheme'] ?? '') !== 'https' ||
                isset($public['user']) || isset($public['pass']) ||
                isset($public['query']) || isset($public['fragment']) ||
                isset($public['port']) || !str_contains($hostname, '.') ||
                filter_var($hostname, FILTER_VALIDATE_IP) ||
                $hostname === 'localhost' || str_ends_with($hostname, '.localhost')) {
                throw ValidationException::withMessages([
                    'public_base_url' => 'La URL pública debe ser HTTPS y pertenecer a un dominio válido.',
                ]);
            }
        }
    }

    private function safeFields(array $values): array
    {
        return array_intersect_key($values, array_flip([
            'name', 'provider', 'bucket', 'endpoint_url', 'public_base_url', 'object_prefix',
        ]));
    }

    private function encryptedFields(array $values): array
    {
        $encrypted = [];
        foreach (['access_key_id', 'secret_access_key'] as $name) {
            // Blank means "keep current credential" in an update.
            if (filled($values[$name] ?? null)) {
                $encrypted[$name.'_encrypted'] = Crypt::encryptString($values[$name]);
            }
        }
        return $encrypted;
    }

    private function audit(Request $request, MediaStorageProfile $profile, string $action): void
    {
        DB::table('audit_events')->insert([
            'id' => (string) Str::ulid(),
            'event_type' => 'MEDIA.STORAGE_PROFILE_'.strtoupper($action),
            'action' => $action,
            'entity_type' => 'MediaStorageProfile',
            'entity_id' => $profile->id,
            'actor_type' => 'user',
            'actor_id' => (string) $request->user()->getAuthIdentifier(),
            'correlation_id' => $request->attributes->get('correlation_id'),
            // Deliberately no request payload, keys or secrets in audit events.
            'metadata' => json_encode(['provider' => $profile->provider, 'selected' => $profile->is_selected]),
            'occurred_at' => now(),
        ]);
    }
}
