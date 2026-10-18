<?php
namespace App\Infrastructure\Media;
use Illuminate\Database\Eloquent\Model;
final class InventoryItemPhoto extends Model {
 public $incrementing=false; protected $keyType='string';
 protected $fillable=['id','inventory_item_id','media_storage_profile_id','object_key','public_url','content_type','byte_size','status','sort_order','is_primary','upload_expires_at'];
 protected $casts=['byte_size'=>'integer','sort_order'=>'integer','is_primary'=>'boolean','upload_expires_at'=>'datetime'];
 public function publicData(): array { return ['id'=>$this->id,'url'=>$this->public_url,'content_type'=>$this->content_type,'byte_size'=>$this->byte_size,'sort_order'=>$this->sort_order,'is_primary'=>$this->is_primary]; }
}