<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
 public function up(): void {
  Schema::create('inventory_item_photos', function (Blueprint $table): void {
   $table->ulid('id')->primary();
   $table->foreignUlid('inventory_item_id')->constrained('inventory_items')->cascadeOnDelete();
   $table->foreignUlid('media_storage_profile_id')->constrained('media_storage_profiles')->restrictOnDelete();
   $table->string('object_key',512)->unique(); $table->string('public_url',2048);
   $table->string('content_type',40); $table->unsignedInteger('byte_size');
   $table->string('status',20)->default('pending')->index();
   $table->unsignedSmallInteger('sort_order')->default(0); $table->boolean('is_primary')->default(false);
   $table->timestamp('upload_expires_at'); $table->timestamps();
   $table->index(['inventory_item_id','status','sort_order']);
  });
 }
 public function down(): void { Schema::dropIfExists('inventory_item_photos'); }
};