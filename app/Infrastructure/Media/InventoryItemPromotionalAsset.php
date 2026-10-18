<?php

namespace App\Infrastructure\Media;

use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class InventoryItemPromotionalAsset extends Model
{
    use HasUlids;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $table = 'inventory_item_promotional_assets';

    protected $fillable = [
        'id',
        'inventory_item_id',
        'source_photo_id',
        'ai_prompt_id',
        'prompt_code',
        'prompt_version',
        'prompt_snapshot',
        'status',
        'media_storage_profile_id',
        'object_key',
        'image_url',
        'mime_type',
        'size_bytes',
        'created_by',
        'approved_by',
        'approved_at',
    ];

    protected $casts = [
        'size_bytes' => 'integer',
        'approved_at' => 'datetime',
    ];

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function sourcePhoto(): BelongsTo
    {
        return $this->belongsTo(InventoryItemPhoto::class, 'source_photo_id');
    }

    public function publicData(): array
    {
        return [
            'id' => $this->id,
            'inventory_item_id' => $this->inventory_item_id,
            'source_photo_id' => $this->source_photo_id,
            'source_photo_url' => $this->sourcePhoto?->public_url,
            'prompt_code' => $this->prompt_code,
            'prompt_version' => $this->prompt_version,
            'prompt_snapshot' => $this->prompt_snapshot,
            'status' => $this->status,
            'image_url' => $this->image_url,
            'mime_type' => $this->mime_type,
            'size_bytes' => $this->size_bytes,
            'created_by' => $this->created_by,
            'approved_by' => $this->approved_by,
            'approved_at' => $this->approved_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
