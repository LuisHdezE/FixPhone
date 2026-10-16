<?php

namespace App\Infrastructure\MasterData;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class DeviceModelSpec extends Model
{
    use HasUlids;

    protected $table = 'device_model_specs';

    protected $fillable = [
        'device_model_id', 'specs_json', 'source_type', 'source_url',
        'source_reference', 'fetched_at', 'reviewed_at', 'reviewed_by',
        'schema_version', 'status',
    ];

    protected $casts = [
        'specs_json' => 'array',
        'fetched_at' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::saving(function (self $spec): void {
            app(DeviceModelReferenceGuard::class)->assertKind($spec->device_model_id, 'deviceModels', 'device_model_id');
        });
    }

    public function modelEntry(): BelongsTo
    {
        return $this->belongsTo(MasterDataEntry::class, 'device_model_id');
    }
}
