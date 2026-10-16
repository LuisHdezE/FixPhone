<?php

namespace App\Infrastructure\Inventory;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Infrastructure\MasterData\DeviceModelReferenceGuard;
use Illuminate\Validation\ValidationException;

class InventoryItem extends Model
{
    use HasUlids, SoftDeletes;

    protected $table = 'inventory_items';

    protected $fillable = [
        'sku',
        'title',
        'description',
        'item_type',
        'brand',
        'model',
        'device_model_id',
        'device_model_variant_id',
        'operational_status',
        'publication_status',
        'inventory_purpose',
        'consignor_id',
        'dismantling_status',
        'is_sellable',
        'stock_quantity',
        'cost_amount_minor',
        'sale_price_amount_minor',
        'currency_code',
        'main_image_url',
        'social_publish_status',
        'auto_publish_to_social',
        'metadata',
    ];

    protected static function booted(): void
    {
        static::saving(function (self $item): void {
            if (!$item->isDirty(['device_model_id', 'device_model_variant_id'])) {
                return;
            }

            if ($item->device_model_id === null && $item->device_model_variant_id === null) {
                return;
            }

            if (!in_array($item->item_type, ['device', 'used_phone'], true)) {
                throw ValidationException::withMessages([
                    'device_model_id' => 'Las referencias a modelos comerciales solo corresponden a teléfonos físicos.',
                ]);
            }

            $guard = app(DeviceModelReferenceGuard::class);
            $guard->assertKind($item->device_model_id, 'deviceModels', 'device_model_id');
            $guard->assertVariantBelongsToModel($item->device_model_variant_id, $item->device_model_id);
        });
    }

    protected $casts = [
        'is_sellable' => 'boolean',
        'stock_quantity' => 'integer',
        'cost_amount_minor' => 'integer',
        'sale_price_amount_minor' => 'integer',
        'auto_publish_to_social' => 'boolean',
        'metadata' => 'array',
    ];
}
