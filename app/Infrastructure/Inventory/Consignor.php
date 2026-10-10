<?php

namespace App\Infrastructure\Inventory;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;

class Consignor extends Model
{
    use HasUlids;

    protected $table = 'consignors';

    protected $fillable = [
        'full_name',
        'document_number',
        'phone',
        'email',
    ];
}
