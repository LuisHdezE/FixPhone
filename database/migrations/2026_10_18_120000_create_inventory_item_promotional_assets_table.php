<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_item_promotional_assets', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('inventory_item_id')->constrained('inventory_items')->cascadeOnDelete();
            $table->foreignUlid('source_photo_id')->constrained('inventory_item_photos')->cascadeOnDelete();
            $table->ulid('ai_prompt_id')->nullable();
            $table->string('prompt_code', 80);
            $table->string('prompt_version', 20)->default('1.0');
            $table->longText('prompt_snapshot');
            $table->string('status', 20)->default('prepared')->index();
            $table->foreignUlid('media_storage_profile_id')->nullable()->constrained('media_storage_profiles')->nullOnDelete();
            $table->string('object_key', 512)->nullable();
            $table->string('image_url', 2048)->nullable();
            $table->string('mime_type', 40)->nullable();
            $table->unsignedInteger('size_bytes')->nullable();
            $table->ulid('created_by')->nullable();
            $table->ulid('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->index(['inventory_item_id', 'status']);
            $table->index(['source_photo_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_item_promotional_assets');
    }
};
