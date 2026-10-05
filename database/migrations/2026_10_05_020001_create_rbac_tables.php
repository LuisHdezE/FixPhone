<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
 public function up(): void
 {
  Schema::create('roles', function (Blueprint $table): void {
   $table->string('slug',80)->primary();
   $table->string('name',120);
   $table->boolean('system')->default(true);
   $table->timestamps();
  });

  Schema::create('permissions', function (Blueprint $table): void {
   $table->string('slug',120)->primary();
   $table->string('name',160);
   $table->timestamps();
  });

  Schema::create('role_permissions', function (Blueprint $table): void {
   $table->string('role_slug',80);
   $table->string('permission_slug',120);
   $table->primary(['role_slug','permission_slug']);
   $table->foreign('role_slug')->references('slug')->on('roles')->cascadeOnDelete();
   $table->foreign('permission_slug')->references('slug')->on('permissions')->cascadeOnDelete();
  });

  Schema::create('user_roles', function (Blueprint $table): void {
   $table->ulid('user_id');
   $table->string('role_slug',80);
   $table->primary(['user_id','role_slug']);
   $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
   $table->foreign('role_slug')->references('slug')->on('roles')->cascadeOnDelete();
  });

  $permissions=[
   'users.manage','catalog.manage','acquisition.manage','consignment.manage',
   'devices.intake','devices.restrictions.manage','diagnosis.manage','routing.manage',
   'routing.override','workshop.repair','workshop.dismantle','inventory.view',
   'inventory.move','inventory.adjust','orders.view','orders.manage','payments.refund',
   'fulfillment.manage','postsale.manage','finance.manage','reports.view',
   'integrations.manage','audit.view'
  ];
  foreach($permissions as $slug){
   DB::table('permissions')->insert(['slug'=>$slug,'name'=>$slug,'created_at'=>now(),'updated_at'=>now()]);
  }

  $roles=[
   'owner'=>'Owner',
   'administrator'=>'Administrator',
   'intake_operator'=>'Intake Operator',
   'technician'=>'Technician',
   'inventory_operator'=>'Inventory Operator',
   'sales_operator'=>'Sales Operator',
   'finance_administrative'=>'Finance / Administrative',
   'postsale_operator'=>'Post-sale Operator',
   'customer'=>'Customer',
  ];
  foreach($roles as $slug=>$name){
   DB::table('roles')->insert(['slug'=>$slug,'name'=>$name,'system'=>true,'created_at'=>now(),'updated_at'=>now()]);
  }

  $all=$permissions;
  $map=[
   'owner'=>$all,
   'administrator'=>$all,
   'intake_operator'=>['acquisition.manage','consignment.manage','devices.intake','inventory.view'],
   'technician'=>['diagnosis.manage','workshop.repair','workshop.dismantle','inventory.view'],
   'inventory_operator'=>['inventory.view','inventory.move','inventory.adjust','fulfillment.manage'],
   'sales_operator'=>['inventory.view','orders.view','orders.manage','fulfillment.manage'],
   'finance_administrative'=>['orders.view','payments.refund','finance.manage','reports.view'],
   'postsale_operator'=>['orders.view','inventory.view','postsale.manage'],
   'customer'=>[],
  ];
  foreach($map as $role=>$grants){
   foreach($grants as $permission){
    DB::table('role_permissions')->insert(['role_slug'=>$role,'permission_slug'=>$permission]);
   }
  }

  $legacy=DB::table('users')->select('id','role')->get();
  foreach($legacy as $row){
   $mapped=$row->role==='owner'?'owner':($row->role==='customer'?'customer':'sales_operator');
   DB::table('user_roles')->insertOrIgnore(['user_id'=>$row->id,'role_slug'=>$mapped]);
  }
 }

 public function down(): void
 {
  Schema::dropIfExists('user_roles');
  Schema::dropIfExists('role_permissions');
  Schema::dropIfExists('permissions');
  Schema::dropIfExists('roles');
 }
};
