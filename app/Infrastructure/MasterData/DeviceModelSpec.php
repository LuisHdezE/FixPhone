<?php

namespace App\Infrastructure\MasterData;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;

final class DeviceModelSpec extends Model
{
    use HasUlids;

    protected $table = 'device_model_specs';
    protected $fillable = ['device_model_id','specs_json','source_type','source_url','source_reference','fetched_at','reviewed_at','reviewed_by','schema_version','status'];
    protected $casts = ['specs_json'=>'array','fetched_at'=>'datetime','reviewed_at'=>'datetime'];

    public function modelEntry()
    {
        return $this->belongsTo(MasterDataEntry::class, 'device_model_id');
    }
}
