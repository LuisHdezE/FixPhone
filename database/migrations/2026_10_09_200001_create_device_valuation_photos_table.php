<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('device_valuation_photos', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('device_valuation_id')->constrained('device_valuations')->cascadeOnDelete();
            $table->foreignUlid('media_storage_profile_id')->constrained('media_storage_profiles')->restrictOnDelete();
            $table->string('object_key', 512)->unique();
            $table->string('public_url', 2048);
            $table->string('content_type', 40);
            $table->unsignedInteger('byte_size');
            $table->string('status', 20)->default('pending')->index();
            $table->timestamp('upload_expires_at');
            $table->timestamps();
            $table->index(['device_valuation_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_valuation_photos');
    }
};
