<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Media\DeviceValuationPhoto;
use App\Infrastructure\Media\MediaStorageProfile;
use App\Infrastructure\Media\R2Presigner;
use App\Infrastructure\Valuation\DeviceValuation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class ValuationPhotosController extends Controller
{
    private const MAX_BYTES = 5 * 1024 * 1024;
    private const MAX_PHOTOS = 8;
    private const MIMES = ['image/webp' => 'webp', 'image/jpeg' => 'jpg', 'image/png' => 'png'];

    public function index(string $id): JsonResponse
    {
        DeviceValuation::query()->findOrFail($id);
        return response()->json(['data' => DeviceValuationPhoto::query()
            ->where('device_valuation_id', $id)->where('status', 'confirmed')
            ->orderBy('created_at')->orderBy('id')->get()
            ->map(static fn (DeviceValuationPhoto $photo): array => $photo->publicData())]);
    }

    public function presign(Request $request, string $id, R2Presigner $signer): JsonResponse
    {
        DeviceValuation::query()->findOrFail($id);

        $values = $request->validate([
            'content_type' => ['required', 'string', Rule::in(array_keys(self::MIMES))],
            'byte_size' => ['required', 'integer', 'min:1', 'max:'.self::MAX_BYTES],
        ]);
        $profile = MediaStorageProfile::query()->where('is_selected', true)->first();
        if (!$profile) {
            // Credentials are validated explicitly below; no implicit env fallback.
            throw ValidationException::withMessages(['storage' => 'Configurá un perfil de almacenamiento preferido.']);
        }
        if (!filled($profile->public_base_url) || !filled($profile->access_key_id_encrypted) ||
            !filled($profile->secret_access_key_encrypted)) {
            throw ValidationException::withMessages(['storage' => 'El perfil seleccionado está incompleto.']);
        }

        $count = DeviceValuationPhoto::query()->where('device_valuation_id', $id)
            ->where(static function ($q): void {
                $q->where('status', 'confirmed')
                    ->orWhere(static function ($pending): void {
                        $pending->where('status', 'pending')->where('upload_expires_at', '>', now());
                    });
            })->count();
        if ($count >= self::MAX_PHOTOS) {
            throw ValidationException::withMessages([
                'photos' => 'Máximo 8 fotos por equipo. Esperá a que venza alguna carga incompleta.',
            ]);
        }

        $photoId = (string) Str::ulid();
        $prefix = trim($profile->object_prefix, '/');
        $key = ($prefix === '' ? '' : $prefix.'/').'valuations/'.$id.'/'.$photoId.'.'.self::MIMES[$values['content_type']];
        $publicUrl = rtrim($profile->public_base_url, '/').'/'
            .implode('/', array_map('rawurlencode', explode('/', $key)));

        $signedUrl = $signer->signedUrl(
            $profile->endpoint_url, $profile->bucket, $key,
            Crypt::decryptString($profile->access_key_id_encrypted),
            Crypt::decryptString($profile->secret_access_key_encrypted),
            'PUT', 180, $values['content_type'],
        );

        DeviceValuationPhoto::query()->create([
            'id' => $photoId,
            'device_valuation_id' => $id,
            'media_storage_profile_id' => $profile->id,
            'object_key' => $key,
            'public_url' => $publicUrl,
            'content_type' => $values['content_type'],
            'byte_size' => $values['byte_size'],
            'status' => 'pending',
            'upload_expires_at' => now()->addMinutes(10),
        ]);

        return response()->json([
            'data' => [
                'id' => $photoId,
                'upload_url' => $signedUrl,
                'content_type' => $values['content_type'],
                'expires_in_seconds' => 180,
            ],
        ], 201)->header('Cache-Control', 'no-store');
    }

    /**
     * Fallback when browser-to-R2 is blocked by a network or CORS policy.
     * Image is limited to 5MB, validated against an existing signed reservation,
     * streamed through this request to R2 and never retained in cPanel storage.
     */
    public function relay(Request $request, string $id, string $photoId, R2Presigner $signer): JsonResponse
    {
        DeviceValuation::query()->findOrFail($id);
        $photo = DeviceValuationPhoto::query()->where('device_valuation_id', $id)->findOrFail($photoId);
        if ($photo->status !== 'pending' || $photo->upload_expires_at->isPast()) {
            throw ValidationException::withMessages([
                'photos' => 'Esta autorización de subida venció. Elegí la fotografía nuevamente.',
            ]);
        }

        $validated = $request->validate([
            'photo' => ['required', 'file', 'mimetypes:image/webp,image/jpeg,image/png', 'max:5120'],
        ]);
        /** @var \Illuminate\Http\UploadedFile $upload */
        $upload = $validated['photo'];
        if ($upload->getSize() !== $photo->byte_size ||
            $upload->getMimeType() !== $photo->content_type) {
            throw ValidationException::withMessages([
                'photo' => 'La fotografía no coincide con el tipo y tamaño autorizados.',
            ]);
        }

        $profile = MediaStorageProfile::query()->findOrFail($photo->media_storage_profile_id);
        $putUrl = $signer->signedUrl(
            $profile->endpoint_url, $profile->bucket, $photo->object_key,
            Crypt::decryptString($profile->access_key_id_encrypted),
            Crypt::decryptString($profile->secret_access_key_encrypted),
            'PUT', 60, $photo->content_type,
        );

        try {
            // PHP uses a temporary upload buffer, not permanent photo storage.
            // Image size is strictly bounded to avoid exhausting hosting RAM.
            $response = Http::timeout(25)->withoutRedirecting()
                ->withBody(file_get_contents($upload->getRealPath()), $photo->content_type)
                ->put($putUrl);
        } catch (\Throwable) {
            throw ValidationException::withMessages([
                'photos' => 'Ni el navegador ni el servidor pudieron conectar con R2. Probá «Probar conexión» en Administración → Almacenamiento de imágenes.',
            ]);
        }
        if (!$response->successful()) {
            throw ValidationException::withMessages([
                'photos' => 'R2 rechazó la transferencia alternativa (HTTP '.$response->status().'). Revisá permisos, bucket y endpoint.',
            ]);
        }

        // One trusted HEAD validates the final object before it is listed.
        return $this->confirm($id, $photoId, $signer);
    }

    public function confirm(string $id, string $photoId, R2Presigner $signer): JsonResponse
    {
        DeviceValuation::query()->findOrFail($id);
        $photo = DeviceValuationPhoto::query()->where('device_valuation_id', $id)->findOrFail($photoId);
        if ($photo->status === 'confirmed') {
            return response()->json(['data' => $photo->publicData()]);
        }
        if ($photo->status !== 'pending' || $photo->upload_expires_at->isPast()) {
            throw ValidationException::withMessages(['photos' => 'La autorización de subida venció. Volvé a seleccionar la foto.']);
        }

        // Read the *original* provider, not today's selected provider. Otherwise
        // switching the active bucket could reinterpret existing object keys.
        $profile = MediaStorageProfile::query()->findOrFail($photo->media_storage_profile_id);
        $signedHead = $signer->signedUrl(
            $profile->endpoint_url, $profile->bucket, $photo->object_key,
            Crypt::decryptString($profile->access_key_id_encrypted),
            Crypt::decryptString($profile->secret_access_key_encrypted),
            'HEAD', 60,
        );

        try {
            $head = Http::timeout(12)->withoutRedirecting()->head($signedHead);
        } catch (\Throwable) {
            throw ValidationException::withMessages(['photos' => 'No se pudo comprobar la imagen en R2. Reintentá en unos segundos.']);
        }

        if (!$head->successful() ||
            filter_var($head->header('Content-Length'), FILTER_VALIDATE_INT) === false ||
            (int) $head->header('Content-Length') !== $photo->byte_size ||
            strtolower(trim(explode(';', $head->header('Content-Type', ''))[0])) !== $photo->content_type) {
            throw ValidationException::withMessages([
                'photos' => 'La imagen no se pudo verificar en R2 (tamaño, tipo o acceso). Consultá la configuración CORS y volvé a intentar.',
            ]);
        }

        DB::transaction(function () use ($photo, $id, $profile): void {
            $photo->status = 'confirmed';
            $photo->save();
            $valuation = DeviceValuation::query()->lockForUpdate()->findOrFail($id);
            if (!$valuation->public_image_url) {
                $valuation->public_image_url = $photo->public_url;
                $valuation->save();
            }
            // A real R2 HEAD succeeded, unlike simply saving a profile.
            $profile->verified_at = now();
            $profile->save();
        });

        return response()->json(['data' => $photo->publicData()]);
    }

    public function primary(string $id, string $photoId): JsonResponse
    {
        $valuation = DeviceValuation::query()->findOrFail($id);
        $photo = DeviceValuationPhoto::query()
            ->where('device_valuation_id', $id)->where('status', 'confirmed')->findOrFail($photoId);
        $valuation->public_image_url = $photo->public_url;
        $valuation->save();

        return response()->json(['data' => ['primary_url' => $photo->public_url]]);
    }
}
