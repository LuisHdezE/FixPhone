<?php

namespace App\Infrastructure\MasterData;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;

final class DeviceModelVariant extends Model
{
    use HasUlids;

    protected $table = 'device_model_variants';
    protected $fillable = ['device_model_id','variant_key','name','ram_capacity_id','storage_capacity_id','region_code','manufacturer_variant_code','differences_json','active'];
    protected $casts = ['differences_json'=>'array','active'=>'boolean'];

    public function modelEntry()
    {
        return $this->belongsTo(MasterDataEntry::class, 'device_model_id');
    }
}
