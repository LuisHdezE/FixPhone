<?php

namespace App\Infrastructure\Media;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

final class MediaStorageProfile extends Model
{
    use HasUlids;

    protected $attributes = ['is_selected' => false];

    protected $fillable = [
        'name', 'provider', 'bucket', 'endpoint_url', 'public_base_url',
        'object_prefix', 'access_key_id_encrypted', 'secret_access_key_encrypted', 'is_selected',
    ];

    protected $hidden = ['access_key_id_encrypted', 'secret_access_key_encrypted'];

    protected $casts = ['is_selected' => 'boolean'];

    public function safeSummary(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'provider' => $this->provider,
            'bucket' => $this->bucket,
            'endpoint_url' => $this->endpoint_url,
            'public_base_url' => $this->public_base_url,
            'object_prefix' => $this->object_prefix,
            'is_selected' => $this->is_selected,
            'has_credentials' => filled($this->access_key_id_encrypted) && filled($this->secret_access_key_encrypted),
            // A saved profile is not proof of a working R2 connection.
            'connection_status' => 'not_tested',
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
