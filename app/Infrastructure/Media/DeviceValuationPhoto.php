<?php

namespace App\Infrastructure\Media;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

final class DeviceValuationPhoto extends Model
{
    use HasUlids;

    protected $fillable = [
        'device_valuation_id', 'media_storage_profile_id', 'object_key',
        'public_url', 'content_type', 'byte_size', 'status', 'upload_expires_at',
    ];

    protected $casts = ['upload_expires_at' => 'immutable_datetime', 'byte_size' => 'integer'];

    protected $hidden = ['object_key', 'media_storage_profile_id'];

    public function publicData(): array
    {
        return ['id' => $this->id, 'url' => $this->public_url];
    }
}
