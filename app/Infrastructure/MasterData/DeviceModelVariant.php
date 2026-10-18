<?php

namespace App\Infrastructure\MasterData;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class DeviceModelVariant extends Model
{
    use HasUlids;

    protected $table = 'device_model_variants';

    protected $fillable = [
        'device_model_id', 'variant_key', 'name', 'ram_capacity_id',
        'storage_capacity_id', 'region_code', 'manufacturer_variant_code',
        'differences_json', 'active',
    ];

    protected $casts = [
        'differences_json' => 'array',
        'active' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::saving(function (self $variant): void {
            $guard = app(DeviceModelReferenceGuard::class);
            $guard->assertKind($variant->device_model_id, 'deviceModels', 'device_model_id');
            $guard->assertCapacities($variant->ram_capacity_id, $variant->storage_capacity_id);
            if ($variant->exists && $variant->isDirty('device_model_id')) {
                // Moving a referenced variant to another model would orphan the pair.
                $guard->assertVariantUnreferenced((string) $variant->getKey());
            }
        });

        static::deleting(function (self $variant): void {
            app(DeviceModelReferenceGuard::class)->assertVariantUnreferenced((string) $variant->getKey());
        });
    }

    public function modelEntry(): BelongsTo
    {
        return $this->belongsTo(MasterDataEntry::class, 'device_model_id');
    }
}
