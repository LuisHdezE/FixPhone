<?php

namespace App\Infrastructure\Inventory;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeviceSaleRecord extends Model
{
    use HasUlids;

    protected $table = 'device_sale_records';

    protected $fillable = [
        'inventory_item_id',
        'effective_sale_price_minor',
        'initial_cost_amount_minor',
        'installed_parts_cost_minor',
        'currency_code',
        'inventory_purpose',
        'consignor_name',
        'sold_at',
        'sold_by_actor_id',
        'receipt_number',
        'notes',
        'status',
        'voided_at',
        'voided_by_actor_id',
        'void_reason',
        'return_to_inventory',
        'request_id',
    ];

    protected $casts = [
        'effective_sale_price_minor' => 'integer',
        'initial_cost_amount_minor' => 'integer',
        'installed_parts_cost_minor' => 'integer',
        'sold_at' => 'datetime',
        'voided_at' => 'datetime',
        'return_to_inventory' => 'boolean',
    ];

    public function device(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }
}
