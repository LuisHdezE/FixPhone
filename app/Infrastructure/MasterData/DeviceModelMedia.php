<?php

namespace App\Infrastructure\MasterData;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class DeviceModelMedia extends Model
{
    use HasUlids;

    protected $table = 'device_model_media';

    protected $fillable = [
        'device_model_id', 'storage_disk', 'object_key', 'media_type',
        'sort_order', 'is_primary', 'source_url', 'attribution',
        'license_status', 'reviewed_at',
    ];

    protected $casts = [
        'is_primary' => 'boolean',
        'reviewed_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::saving(function (self $media): void {
            app(DeviceModelReferenceGuard::class)->assertKind($media->device_model_id, 'deviceModels', 'device_model_id');
        });
    }

    public function modelEntry(): BelongsTo
    {
        return $this->belongsTo(MasterDataEntry::class, 'device_model_id');
    }
}
