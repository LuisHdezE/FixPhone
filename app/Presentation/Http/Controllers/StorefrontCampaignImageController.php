<?php
namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Media\MediaStorageProfile;
use App\Infrastructure\Media\R2Presigner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class StorefrontCampaignImageController
{
    public function __invoke(Request $request, R2Presigner $signer): JsonResponse
    {
        $values = $request->validate([
            'image' => ['required', 'file', 'image', 'mimetypes:image/webp,image/jpeg,image/png',
                'max:2048', 'dimensions:max_width=4096,max_height=4096'],
        ]);
        $image = $values['image'];
        $profile = MediaStorageProfile::query()->where('is_selected', true)->first();
        if (!$profile || !filled($profile->public_base_url) || !filled($profile->access_key_id_encrypted) ||
            !filled($profile->secret_access_key_encrypted)) {
            throw ValidationException::withMessages(['image' => 'Configurá y seleccioná un perfil en Almacenamiento multimedia antes de subir imágenes.']);
        }

        $mime = $image->getMimeType();
        $extension = ['image/webp' => 'webp', 'image/jpeg' => 'jpg', 'image/png' => 'png'][$mime];
        $prefix = trim($profile->object_prefix, '/');
        $key = ($prefix === '' ? '' : $prefix.'/').'store/campaigns/'.Str::ulid().'.'.$extension;
        $publicUrl = rtrim($profile->public_base_url, '/').'/'.implode('/', array_map('rawurlencode', explode('/', $key)));
        if (strlen($publicUrl) > 2000) {
            throw ValidationException::withMessages(['image' => 'La URL pública del almacenamiento es demasiado larga. Revisá el perfil seleccionado.']);
        }
        try {
            $access = Crypt::decryptString($profile->access_key_id_encrypted);
            $secret = Crypt::decryptString($profile->secret_access_key_encrypted);
            // Keep the original selected profile for both operations. No browser CORS or secrets required.
            $put = $signer->signedUrl($profile->endpoint_url, $profile->bucket, $key, $access, $secret, 'PUT', 60, $mime);
            $response = Http::timeout(25)->withoutRedirecting()->withBody(file_get_contents($image->getRealPath()), $mime)->put($put);
            if (!$response->successful()) throw new \RuntimeException('Upload rejected');
            $head = Http::timeout(12)->withoutRedirecting()->head(
                $signer->signedUrl($profile->endpoint_url, $profile->bucket, $key, $access, $secret, 'HEAD', 60));
            if (!$head->successful() || filter_var($head->header('Content-Length'), FILTER_VALIDATE_INT) === false ||
                (int) $head->header('Content-Length') !== $image->getSize() ||
                strtolower(trim(explode(';', $head->header('Content-Type', ''))[0])) !== $mime) {
                throw new \RuntimeException('Verification failed');
            }
        } catch (\Throwable) {
            // Never return provider URLs containing signatures or credentials in an error.
            throw ValidationException::withMessages(['image' => 'No se pudo subir o verificar la imagen. Revisá la conexión del almacenamiento y volvé a intentar.']);
        }
        return response()->json(['data' => ['url' => $publicUrl]], 201)->header('Cache-Control', 'no-store');
    }
}
