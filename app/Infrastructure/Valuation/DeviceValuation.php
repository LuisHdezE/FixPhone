<?php

namespace App\Infrastructure\Valuation;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Infrastructure\Media\DeviceValuationPhoto;
use App\Infrastructure\Inventory\InventoryItem;

final class DeviceValuation extends Model
{
    use HasUlids;

    protected $fillable = [
        'inventory_item_id', 'model_name', 'fault_type', 'screen_condition',
        'power_state', 'estimated_min_minor', 'estimated_max_minor',
        'asking_price_minor', 'minimum_price_minor', 'publication_status',
        'market_reference', 'notes', 'facebook_copy', 'facebook_post_url', 'created_by',
        'public_listing_status', 'public_image_url', 'public_description', 'provenance_confirmed',
    ];

    protected $casts = [
        'provenance_confirmed' => 'boolean',
        'estimated_min_minor' => 'integer',
        'estimated_max_minor' => 'integer',
        'asking_price_minor' => 'integer',
        'minimum_price_minor' => 'integer',
    ];
    public function verifiedPhotos(): HasMany
    {
        return $this->hasMany(DeviceValuationPhoto::class, 'device_valuation_id')
            ->where('status', 'confirmed')->orderBy('created_at')->orderBy('id');
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }
}
