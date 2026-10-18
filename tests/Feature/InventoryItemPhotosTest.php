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
 private function device():InventoryItem{return InventoryItem::query()->create(['sku'=>'FXP-'.Str::upper(Str::random(8)),'title'=>'Samsung A22','item_type'=>'used_phone','brand'=>'Samsung','model'=>'A22','operational_status'=>'ingresado','publication_status'=>'no_publicable','inventory_purpose'=>'internal_use','stock_quantity'=>1,'currency_code'=>'UYU','metadata'=>[]]);}
 private function profile():void{MediaStorageProfile::query()->create(['name'=>'R2','provider'=>'r2','bucket'=>'images','endpoint_url'=>'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com','public_base_url'=>'https://cdn.test','object_prefix'=>'media','access_key_id_encrypted'=>Crypt::encryptString('access'),'secret_access_key_encrypted'=>Crypt::encryptString('secret'),'is_selected'=>true]);}
 public function test_gallery_requires_permissions():void{$d=$this->device();$this->getJson('/api/v1/admin/inventory/'.$d->id.'/photos')->assertUnauthorized();$this->auth('intake_operator');$this->getJson('/api/v1/admin/inventory/'.$d->id.'/photos')->assertOk();$this->postJson('/api/v1/admin/inventory/'.$d->id.'/photos/presign',['content_type'=>'image/webp','byte_size'=>10])->assertForbidden();}
 public function test_owner_can_upload_verify_and_make_primary():void{$this->auth();$this->profile();$d=$this->device();Http::fake(fn($req)=>$req->method()==='HEAD'?Http::response('',200,['Content-Length'=>'10','Content-Type'=>'image/webp']):Http::response('',200));
  $grant=$this->postJson('/api/v1/admin/inventory/'.$d->id.'/photos/presign',['content_type'=>'image/webp','byte_size'=>10])->assertCreated()->json('data');
  $this->assertStringContainsString('/inventory/devices/'.$d->id.'/',$grant['upload_url']);
  $this->postJson('/api/v1/admin/inventory/'.$d->id.'/photos/'.$grant['id'].'/confirm')->assertOk()->assertJsonPath('data.is_primary',true);
  $this->getJson('/api/v1/admin/inventory/'.$d->id.'/photos')->assertOk()->assertJsonCount(1,'data')->assertJsonPath('data.0.is_primary',true);
 }
 public function test_gallery_rejects_non_phone_and_too_large_upload():void{$this->auth();$this->profile();$d=$this->device();$d->item_type='spare_part';$d->save();$this->postJson('/api/v1/admin/inventory/'.$d->id.'/photos/presign',['content_type'=>'image/webp','byte_size'=>10])->assertNotFound();$phone=$this->device();$this->postJson('/api/v1/admin/inventory/'.$phone->id.'/photos/presign',['content_type'=>'image/webp','byte_size'=>5*1024*1024+1])->assertUnprocessable()->assertJsonValidationErrors('byte_size');}

 public function test_showroom_list_prioritizes_confirmed_photos_then_model_fallback(): void
 {
     $this->profile();
     $profile = MediaStorageProfile::query()->first();

     // Device 1: Has confirmed real photos
     $d1 = InventoryItem::query()->create([
         'sku' => 'FXP-REAL-01',
         'title' => 'iPhone 13 Azul',
         'item_type' => 'used_phone',
         'brand' => 'Apple',
         'model' => 'iPhone 13',
         'operational_status' => 'disponible',
         'publication_status' => 'publicado',
         'inventory_purpose' => 'sell_as_used_phone',
         'is_sellable' => true,
         'stock_quantity' => 1,
         'sale_price_amount_minor' => 2500000,
         'currency_code' => 'UYU',
         'main_image_url' => 'https://cdn.test/stale-generic.webp',
         'metadata' => [],
     ]);

     \App\Infrastructure\Media\InventoryItemPhoto::query()->create([
         'id' => (string) Str::ulid(),
         'inventory_item_id' => $d1->id,
         'media_storage_profile_id' => $profile->id,
         'object_key' => 'media/photo1.webp',
         'public_url' => 'https://cdn.test/real-primary.webp',
         'content_type' => 'image/webp',
         'byte_size' => 1200,
         'status' => 'confirmed',
         'sort_order' => 0,
         'is_primary' => true,
         'upload_expires_at' => now()->addHour(),
     ]);

     \App\Infrastructure\Media\InventoryItemPhoto::query()->create([
         'id' => (string) Str::ulid(),
         'inventory_item_id' => $d1->id,
         'media_storage_profile_id' => $profile->id,
         'object_key' => 'media/photo2.webp',
         'public_url' => 'https://cdn.test/real-secondary.webp',
         'content_type' => 'image/webp',
         'byte_size' => 1300,
         'status' => 'confirmed',
         'sort_order' => 1,
         'is_primary' => false,
         'upload_expires_at' => now()->addHour(),
     ]);

     // Device 2: 0 real photos, has model generic image
     $modelId = (string) Str::ulid();
     DB::table('master_data_entries')->insert([
         'id' => $modelId,
         'kind' => 'deviceModels',
         'payload' => json_encode(['name' => 'iPhone 12', 'imageUrl' => 'https://cdn.test/model-generic.webp']),
         'created_at' => now(),
         'updated_at' => now(),
     ]);

     $d2 = InventoryItem::query()->create([
         'sku' => 'FXP-MODEL-02',
         'title' => 'iPhone 12 Negro',
         'item_type' => 'used_phone',
         'brand' => 'Apple',
         'model' => 'iPhone 12',
         'device_model_id' => $modelId,
         'operational_status' => 'disponible',
         'publication_status' => 'publicado',
         'inventory_purpose' => 'sell_as_used_phone',
         'is_sellable' => true,
         'stock_quantity' => 1,
         'sale_price_amount_minor' => 1800000,
         'currency_code' => 'UYU',
         'main_image_url' => null,
         'metadata' => ['device_model_id' => $modelId],
     ]);

     $response = $this->getJson('/api/v1/store/products')->assertOk();
     $items = collect($response->json());

     $item1 = $items->firstWhere('id', $d1->id);
     $this->assertNotNull($item1);
     $this->assertSame('https://cdn.test/real-primary.webp', $item1['main_image_url']);
     $this->assertCount(2, $item1['photos']);
     $this->assertSame('https://cdn.test/real-primary.webp', $item1['photos'][0]['url']);
     $this->assertTrue($item1['photos'][0]['is_primary']);
     $this->assertSame('https://cdn.test/real-secondary.webp', $item1['photos'][1]['url']);

     $item2 = $items->firstWhere('id', $d2->id);
     $this->assertNotNull($item2);
     $this->assertSame('https://cdn.test/model-generic.webp', $item2['main_image_url']);
     $this->assertEmpty($item2['photos']);
 }
}