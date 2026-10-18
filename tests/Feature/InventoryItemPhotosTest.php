<?php
namespace Tests\Feature;
use App\Infrastructure\Identity\User;
use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\Media\MediaStorageProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class InventoryItemPhotosTest extends TestCase {
 use RefreshDatabase;
 private function auth(string $role='owner'):void{$u=User::query()->create(['id'=>(string)Str::ulid(),'name'=>'Photo','email'=>$role.'@photos.test','password'=>Hash::make('x'),'active'=>true]);DB::table('user_roles')->insert(['user_id'=>$u->id,'role_slug'=>$role]);Sanctum::actingAs($u);}
 private function device():InventoryItem{return InventoryItem::query()->create(['sku'=>'FXP-PHOTO','title'=>'Samsung A22','item_type'=>'used_phone','brand'=>'Samsung','model'=>'A22','operational_status'=>'ingresado','publication_status'=>'no_publicable','inventory_purpose'=>'internal_use','stock_quantity'=>1,'currency_code'=>'UYU','metadata'=>[]]);}
 private function profile():void{MediaStorageProfile::query()->create(['name'=>'R2','provider'=>'r2','bucket'=>'images','endpoint_url'=>'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com','public_base_url'=>'https://cdn.test','object_prefix'=>'media','access_key_id_encrypted'=>Crypt::encryptString('access'),'secret_access_key_encrypted'=>Crypt::encryptString('secret'),'is_selected'=>true]);}
 public function test_gallery_requires_permissions():void{$d=$this->device();$this->getJson('/api/v1/admin/inventory/'.$d->id.'/photos')->assertUnauthorized();$this->auth('intake_operator');$this->getJson('/api/v1/admin/inventory/'.$d->id.'/photos')->assertOk();$this->postJson('/api/v1/admin/inventory/'.$d->id.'/photos/presign',['content_type'=>'image/webp','byte_size'=>10])->assertForbidden();}
 public function test_owner_can_upload_verify_and_make_primary():void{$this->auth();$this->profile();$d=$this->device();Http::fake(fn($req)=>$req->method()==='HEAD'?Http::response('',200,['Content-Length'=>'10','Content-Type'=>'image/webp']):Http::response('',200));
  $grant=$this->postJson('/api/v1/admin/inventory/'.$d->id.'/photos/presign',['content_type'=>'image/webp','byte_size'=>10])->assertCreated()->json('data');
  $this->assertStringContainsString('/inventory/devices/'.$d->id.'/',$grant['upload_url']);
  $this->postJson('/api/v1/admin/inventory/'.$d->id.'/photos/'.$grant['id'].'/confirm')->assertOk()->assertJsonPath('data.is_primary',true);
  $this->getJson('/api/v1/admin/inventory/'.$d->id.'/photos')->assertOk()->assertJsonCount(1,'data')->assertJsonPath('data.0.is_primary',true);
 }
 public function test_gallery_rejects_non_phone_and_too_large_upload():void{$this->auth();$this->profile();$d=$this->device();$d->item_type='spare_part';$d->save();$this->postJson('/api/v1/admin/inventory/'.$d->id.'/photos/presign',['content_type'=>'image/webp','byte_size'=>10])->assertNotFound();$phone=$this->device();$this->postJson('/api/v1/admin/inventory/'.$phone->id.'/photos/presign',['content_type'=>'image/webp','byte_size'=>5*1024*1024+1])->assertUnprocessable()->assertJsonValidationErrors('byte_size');}
}