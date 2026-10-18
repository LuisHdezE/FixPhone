<?php

namespace App\Infrastructure\MasterData;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Validation\ValidationException;

final class DeviceModelMedia extends Model
{
    use HasUlids;

    protected $table = 'device_model_media';

    protected $fillable = [
        'device_model_id', 'device_model_variant_id', 'storage_disk', 'object_key', 'media_type',
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
            $guard = app(DeviceModelReferenceGuard::class);
            $guard->assertKind($media->device_model_id, 'deviceModels', 'device_model_id');
            $guard->assertVariantBelongsToModel($media->device_model_variant_id, $media->device_model_id);
        });

        // Removing a row forgets an R2 object key. Until the deferred, retryable
        // and auditable deletion process exists, rows are never deleted silently.
        static::deleting(function (): void {
            throw ValidationException::withMessages([
                'media' => 'Las imágenes del catálogo no se eliminan directamente: se retiran mediante el proceso diferido y auditable para evitar archivos huérfanos.',
            ]);
        });
    }

    public function modelEntry(): BelongsTo
    {
        return $this->belongsTo(MasterDataEntry::class, 'device_model_id');
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(DeviceModelVariant::class, 'device_model_variant_id');
    }
}
