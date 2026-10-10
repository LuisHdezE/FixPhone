<?php

namespace App\Infrastructure\Inventory;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;

class InventoryItem extends Model
{
    use HasUlids;

    protected $table = 'inventory_items';

    protected $fillable = [
        'sku',
        'title',
        'description',
        'item_type',
        'brand',
        'model',
        'operational_status',
        'publication_status',
        'inventory_purpose',
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

    protected $casts = [
        'is_sellable' => 'boolean',
        'stock_quantity' => 'integer',
        'cost_amount_minor' => 'integer',
        'sale_price_amount_minor' => 'integer',
        'auto_publish_to_social' => 'boolean',
        'metadata' => 'array',
    ];
}
