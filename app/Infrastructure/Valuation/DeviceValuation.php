<?php

namespace App\Infrastructure\Valuation;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

final class DeviceValuation extends Model
{
    use HasUlids;

    protected $fillable = [
        'inventory_item_id', 'model_name', 'fault_type', 'screen_condition',
        'power_state', 'estimated_min_minor', 'estimated_max_minor',
        'asking_price_minor', 'minimum_price_minor', 'publication_status',
        'market_reference', 'notes', 'facebook_copy', 'facebook_post_url', 'created_by',
    ];

    protected $casts = [
        'estimated_min_minor' => 'integer',
        'estimated_max_minor' => 'integer',
        'asking_price_minor' => 'integer',
        'minimum_price_minor' => 'integer',
    ];
}
