<?php
namespace App\Infrastructure\Media;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class VerifiedR2ImageUploader
{
    public function __construct(private readonly R2Presigner $signer) {}

    public function upload(UploadedFile $image, string $folder): string
    {
        $profile = MediaStorageProfile::query()->where('is_selected', true)->first();
        if (!$profile || !filled($profile->public_base_url) || !filled($profile->access_key_id_encrypted) ||
            !filled($profile->secret_access_key_encrypted)) {
            throw ValidationException::withMessages(['image' => 'Configurá y seleccioná un perfil en Almacenamiento de imágenes antes de subir imágenes.']);
        }

        $mime = $image->getMimeType();
        $extension = ['image/webp' => 'webp', 'image/jpeg' => 'jpg', 'image/png' => 'png'][$mime];
        $prefix = trim($profile->object_prefix, '/');
        $key = ($prefix === '' ? '' : $prefix.'/').$folder.'/'.Str::ulid().'.'.$extension;
        $publicUrl = rtrim($profile->public_base_url, '/').'/'.implode('/', array_map('rawurlencode', explode('/', $key)));
        if (strlen($publicUrl) > 2000) {
            throw ValidationException::withMessages(['image' => 'La URL pública del almacenamiento es demasiado larga. Revisá el perfil seleccionado.']);
        }
        try {
            $access = Crypt::decryptString($profile->access_key_id_encrypted);
            $secret = Crypt::decryptString($profile->secret_access_key_encrypted);
            $put = $this->signer->signedUrl($profile->endpoint_url, $profile->bucket, $key, $access, $secret, 'PUT', 60, $mime);
            $response = Http::timeout(25)->withoutRedirecting()->withBody(file_get_contents($image->getRealPath()), $mime)->put($put);
            if (!$response->successful()) throw new \RuntimeException('Upload rejected');
            $head = Http::timeout(12)->withoutRedirecting()->head(
                $this->signer->signedUrl($profile->endpoint_url, $profile->bucket, $key, $access, $secret, 'HEAD', 60));
            if (!$head->successful() || filter_var($head->header('Content-Length'), FILTER_VALIDATE_INT) === false ||
                (int) $head->header('Content-Length') !== $image->getSize() ||
                strtolower(trim(explode(';', $head->header('Content-Type', ''))[0])) !== $mime) {
                throw new \RuntimeException('Verification failed');
            }
        } catch (\Throwable) {
            // Signed URLs and credentials never appear in API errors.
            throw ValidationException::withMessages(['image' => 'No se pudo subir o verificar la imagen. Revisá la conexión R2 y volvé a intentar.']);
        }
        return $publicUrl;
    }
}
