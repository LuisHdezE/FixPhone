<?php

namespace App\Infrastructure\RepairQuotes;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

final class RepairQuote extends Model
{
    use HasUlids;

    protected $fillable = [
        'customer_name', 'customer_contact', 'device_description', 'device_tier',
        'services', 'parts', 'parts_markup_percent', 'services_subtotal_minor',
        'parts_base_minor', 'parts_total_minor', 'courier_minor', 'discount_minor',
        'total_minor', 'currency_code', 'notes', 'created_by',
    ];

    protected $casts = [
        'services' => 'array', 'parts' => 'array',
        'parts_markup_percent' => 'integer',
        'services_subtotal_minor' => 'integer', 'parts_base_minor' => 'integer',
        'parts_total_minor' => 'integer', 'courier_minor' => 'integer',
        'discount_minor' => 'integer', 'total_minor' => 'integer',
    ];
}
