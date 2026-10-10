<?php

namespace App\Infrastructure\Inventory;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeviceInstalledPart extends Model
{
    use HasUlids;

    protected $table = 'device_installed_parts';

    protected $fillable = [
        'inventory_item_id',
        'spare_part_item_id',
        'part_name',
        'cost_amount_minor',
        'currency_code',
        'installed_at',
        'installed_by_actor_id',
        'notes',
        'voided_at',
        'voided_by_actor_id',
        'void_reason',
        'request_id',
    ];

    protected $casts = [
        'cost_amount_minor' => 'integer',
        'installed_at' => 'datetime',
        'voided_at' => 'datetime',
    ];

    public function device(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function sparePart(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'spare_part_item_id');
    }
}
