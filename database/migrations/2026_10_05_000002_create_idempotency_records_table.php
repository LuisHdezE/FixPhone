<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
 public function up():void{Schema::create('idempotency_records',function(Blueprint $table):void{$table->id();$table->string('scope',120);$table->string('idempotency_key',160);$table->string('request_hash',64);$table->string('state',24);$table->unsignedSmallInteger('response_status')->nullable();$table->json('response_body')->nullable();$table->timestamps();$table->unique(['scope','idempotency_key']);});}
 public function down():void{Schema::dropIfExists('idempotency_records');}
};
