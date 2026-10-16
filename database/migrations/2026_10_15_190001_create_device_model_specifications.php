<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('device_model_specs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('device_model_id')->unique();
            $table->json('specs_json');
            $table->string('source_type', 40)->default('manual');
            $table->text('source_url')->nullable();
            $table->string('source_reference')->nullable();
            $table->timestamp('fetched_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->ulid('reviewed_by')->nullable();
            $table->unsignedInteger('schema_version')->default(1);
            $table->string('status', 24)->default('draft');
            $table->timestamps();
            $table->foreign('device_model_id')->references('id')->on('master_data_entries')->restrictOnDelete();
            $table->foreign('reviewed_by')->references('id')->on('users')->restrictOnDelete();
        });

        Schema::create('device_model_media', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('device_model_id');
            $table->string('storage_disk', 80);
            $table->string('object_key', 1024);
            $table->string('media_type', 80);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_primary')->default(false);
            $table->text('source_url')->nullable();
            $table->text('attribution')->nullable();
            $table->string('license_status', 40)->default('unverified');
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->index(['device_model_id', 'sort_order']);
            $table->foreign('device_model_id')->references('id')->on('master_data_entries')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_model_media');
        Schema::dropIfExists('device_model_specs');
    }
};
