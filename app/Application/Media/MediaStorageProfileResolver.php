<?php

namespace App\Application\Media;

use App\Infrastructure\Media\MediaStorageProfile;
use Illuminate\Support\Facades\Crypt;

/**
 * Reusable, tenant-installation-local media storage configuration.
 * Consumers must NOT return this credential-bearing array to the browser.
 * A future R2/S3 adapter will use this to issue time-limited upload grants.
 */
final class MediaStorageProfileResolver
{
    public function selected(): ?array
    {
        $profile = MediaStorageProfile::query()->where('is_selected', true)->first();
        if ($profile === null) {
            return null;
        }

        return [
            'provider' => $profile->provider,
            'bucket' => $profile->bucket,
            'endpoint_url' => $profile->endpoint_url,
            'public_base_url' => $profile->public_base_url,
            'object_prefix' => $profile->object_prefix,
            'access_key_id' => $profile->access_key_id_encrypted
                ? Crypt::decryptString($profile->access_key_id_encrypted) : null,
            'secret_access_key' => $profile->secret_access_key_encrypted
                ? Crypt::decryptString($profile->secret_access_key_encrypted) : null,
        ];
    }
}
