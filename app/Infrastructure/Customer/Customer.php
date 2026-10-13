<?php

namespace App\Infrastructure\Customer;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * CRM contact. Deliberately separate from admin users and consignors.
 */
final class Customer extends Model
{
    use HasUlids, SoftDeletes;

    protected $table = 'crm_customers';

    protected $fillable = [
        'full_name',
        'email',
        'phone',
        'relationship_state',
        'notes',
    ];

    protected $hidden = ['deleted_at'];
}
