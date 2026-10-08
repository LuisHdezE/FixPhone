<?php

namespace App\Infrastructure\MasterData;

use Illuminate\Database\Eloquent\Model;

final class MasterDataEntry extends Model
{
    protected $table = 'master_data_entries';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'kind',
        'payload',
    ];

    protected $casts = [
        'payload' => 'array',
    ];
}
