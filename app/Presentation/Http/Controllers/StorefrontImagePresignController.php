<?php

namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Media\MediaStorageProfile;
use App\Infrastructure\Media\R2Presigner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class StorefrontImagePresignController
{
    public function __invoke(Request $request, R2Presigner $signer): JsonResponse
    {
        $values = $request->validate([
            'kind' => ['required', Rule::in(['campaigns', 'products', 'models'])],
            'byte_size' => ['required', 'integer', 'min:1', 'max:2097152'],
            'content_type' => ['required', Rule::in(['image/webp'])],
        ]);
        $profile = MediaStorageProfile::query()->where('is_selected', true)->first();
        if (!$profile || !filled($profile->public_base_url) || !filled($profile->access_key_id_encrypted) ||
            !filled($profile->secret_access_key_encrypted)) {
            throw ValidationException::withMessages(['image' => 'Configurá y seleccioná un perfil R2 completo antes de subir imágenes.']);
        }

        $prefix = trim($profile->object_prefix, '/');
        $key = ($prefix === '' ? '' : $prefix.'/').'store/'.$values['kind'].'/'.Str::ulid().'.webp';
        $publicUrl = rtrim($profile->public_base_url, '/').'/'
            .implode('/', array_map('rawurlencode', explode('/', $key)));
        if (strlen($publicUrl) > 2000) {
            throw ValidationException::withMessages(['image' => 'La URL pública de R2 es demasiado larga.']);
        }

        $uploadUrl = $signer->signedUrl(
            $profile->endpoint_url, $profile->bucket, $key,
            Crypt::decryptString($profile->access_key_id_encrypted),
            Crypt::decryptString($profile->secret_access_key_encrypted),
            'PUT', 180, $values['content_type'],
        );

        return response()->json(['data' => [
            'upload_url' => $uploadUrl,
            'url' => $publicUrl,
            'content_type' => $values['content_type'],
            'expires_in_seconds' => 180,
        ]], 201)->header('Cache-Control', 'no-store');
    }
}
