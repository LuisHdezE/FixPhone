<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
 public function up(): void { Schema::create('audit_events',function(Blueprint $table):void{$table->ulid('id')->primary();$table->string('event_type',120);$table->string('action',120);$table->string('entity_type',120);$table->string('entity_id',80);$table->string('actor_type',80)->nullable();$table->string('actor_id',80)->nullable();$table->string('correlation_id',100)->nullable()->index();$table->json('metadata')->nullable();$table->timestamp('occurred_at')->index();$table->index(['entity_type','entity_id','occurred_at']);});}
 public function down():void{Schema::dropIfExists('audit_events');}
};
