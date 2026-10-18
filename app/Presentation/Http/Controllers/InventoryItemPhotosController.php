<?php
namespace App\Presentation\Http\Controllers;

use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\Media\InventoryItemPhoto;
use App\Infrastructure\Media\MediaStorageProfile;
use App\Infrastructure\Media\R2Presigner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class InventoryItemPhotosController extends Controller
{
 private const MAX_BYTES=5*1024*1024; private const MAX_PHOTOS=8;
 private const MIMES=['image/webp'=>'webp','image/jpeg'=>'jpg','image/png'=>'png'];

 private function item(string $id): InventoryItem {
  $item=InventoryItem::query()->findOrFail($id);
  abort_unless($item->item_type==='used_phone',404);
  return $item;
 }
 private function photos(string $id) {
  return InventoryItemPhoto::query()->where('inventory_item_id',$id)->where('status','confirmed')
   ->orderByDesc('is_primary')->orderBy('sort_order')->orderBy('id');
 }
 public function index(string $id): JsonResponse {
  $this->item($id); return response()->json(['data'=>$this->photos($id)->get()->map(fn($p)=>$p->publicData())]);
 }
 public function presign(Request $request,string $id,R2Presigner $signer): JsonResponse {
  $this->item($id);
  $v=$request->validate(['content_type'=>['required',Rule::in(array_keys(self::MIMES))],'byte_size'=>['required','integer','min:1','max:'.self::MAX_BYTES]]);
  $profile=MediaStorageProfile::query()->where('is_selected',true)->first();
  if(!$profile || !filled($profile->public_base_url) || !filled($profile->access_key_id_encrypted) || !filled($profile->secret_access_key_encrypted))
   throw ValidationException::withMessages(['image'=>'Configurá y seleccioná un perfil de almacenamiento R2.']);
  $count=InventoryItemPhoto::query()->where('inventory_item_id',$id)->where(function($q){$q->where('status','confirmed')->orWhere(function($p){$p->where('status','pending')->where('upload_expires_at','>',now());});})->count();
  if($count>=self::MAX_PHOTOS) throw ValidationException::withMessages(['image'=>'Máximo 8 fotos por dispositivo.']);
  $photoId=(string)Str::ulid(); $prefix=trim($profile->object_prefix,'/');
  $key=($prefix===''?'':$prefix.'/').'inventory/devices/'.$id.'/'.$photoId.'.'.self::MIMES[$v['content_type']];
  $url=rtrim($profile->public_base_url,'/').'/'.implode('/',array_map('rawurlencode',explode('/',$key)));
  $signed=$signer->signedUrl($profile->endpoint_url,$profile->bucket,$key,Crypt::decryptString($profile->access_key_id_encrypted),Crypt::decryptString($profile->secret_access_key_encrypted),'PUT',180,$v['content_type']);
  $order=(int)(InventoryItemPhoto::query()->where('inventory_item_id',$id)->max('sort_order')??-1)+1;
  InventoryItemPhoto::query()->create(['id'=>$photoId,'inventory_item_id'=>$id,'media_storage_profile_id'=>$profile->id,'object_key'=>$key,'public_url'=>$url,'content_type'=>$v['content_type'],'byte_size'=>$v['byte_size'],'status'=>'pending','sort_order'=>$order,'is_primary'=>false,'upload_expires_at'=>now()->addMinutes(10)]);
  return response()->json(['data'=>['id'=>$photoId,'upload_url'=>$signed,'content_type'=>$v['content_type']]],201)->header('Cache-Control','no-store');
 }
 public function confirm(string $id,string $photoId,R2Presigner $signer): JsonResponse {
  $this->item($id); $photo=InventoryItemPhoto::query()->where('inventory_item_id',$id)->findOrFail($photoId);
  if($photo->status==='confirmed') return response()->json(['data'=>$photo->publicData()]);
  if($photo->status!=='pending'||$photo->upload_expires_at->isPast()) throw ValidationException::withMessages(['image'=>'La autorización de subida venció.']);
  $profile=MediaStorageProfile::query()->findOrFail($photo->media_storage_profile_id);
  $head=$signer->signedUrl($profile->endpoint_url,$profile->bucket,$photo->object_key,Crypt::decryptString($profile->access_key_id_encrypted),Crypt::decryptString($profile->secret_access_key_encrypted),'HEAD',60);
  try{$res=Http::timeout(12)->withoutRedirecting()->head($head);}catch(\Throwable){throw ValidationException::withMessages(['image'=>'No se pudo verificar la imagen en R2.']);}
  if(!$res->successful() || filter_var($res->header('Content-Length'),FILTER_VALIDATE_INT)===false || (int)$res->header('Content-Length')!==$photo->byte_size || strtolower(trim(explode(';',$res->header('Content-Type',''))[0]))!==$photo->content_type)
   throw ValidationException::withMessages(['image'=>'La imagen no pudo verificarse en R2.']);
  DB::transaction(function()use($photo,$id){$has=InventoryItemPhoto::query()->where('inventory_item_id',$id)->where('status','confirmed')->exists();$photo->status='confirmed';$photo->is_primary=!$has;$photo->save();});
  return response()->json(['data'=>$photo->fresh()->publicData()]);
 }
 public function primary(string $id,string $photoId): JsonResponse {
  $this->item($id); $photo=InventoryItemPhoto::query()->where('inventory_item_id',$id)->where('status','confirmed')->findOrFail($photoId);
  DB::transaction(function()use($id,$photo){InventoryItemPhoto::query()->where('inventory_item_id',$id)->update(['is_primary'=>false]);$photo->is_primary=true;$photo->save();});
  return response()->json(['data'=>$photo->fresh()->publicData()]);
 }
 public function order(Request $request,string $id): JsonResponse {
  $this->item($id); $v=$request->validate(['photo_ids'=>['required','array','max:8'],'photo_ids.*'=>['required','string','distinct']]);
  $existing=$this->photos($id)->pluck('id')->all(); $ids=$v['photo_ids']; sort($existing);$check=$ids;sort($check);
  if($existing!==$check) throw ValidationException::withMessages(['photo_ids'=>'El orden debe incluir exactamente todas las fotos confirmadas.']);
  DB::transaction(fn()=>collect($ids)->each(fn($photoId,$i)=>InventoryItemPhoto::query()->where('inventory_item_id',$id)->whereKey($photoId)->update(['sort_order'=>$i])));
  return $this->index($id);
 }
 public function destroy(string $id,string $photoId,R2Presigner $signer): JsonResponse {
  $this->item($id); $photo=InventoryItemPhoto::query()->where('inventory_item_id',$id)->where('status','confirmed')->findOrFail($photoId); $was=$photo->is_primary;
  $profile=MediaStorageProfile::query()->findOrFail($photo->media_storage_profile_id);
  try{$delete=$signer->signedUrl($profile->endpoint_url,$profile->bucket,$photo->object_key,Crypt::decryptString($profile->access_key_id_encrypted),Crypt::decryptString($profile->secret_access_key_encrypted),'DELETE',60);$res=Http::timeout(12)->withoutRedirecting()->delete($delete);if(!$res->successful()&&$res->status()!==404) throw new \RuntimeException();}catch(\Throwable){throw ValidationException::withMessages(['image'=>'No se pudo eliminar la imagen de R2.']);}
  DB::transaction(function()use($photo,$id,$was){$photo->delete();if($was){$next=InventoryItemPhoto::query()->where('inventory_item_id',$id)->where('status','confirmed')->orderBy('sort_order')->first();if($next){$next->is_primary=true;$next->save();}}});
  return response()->json(null,204);
 }
}