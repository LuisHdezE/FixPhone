<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('device_model_variants', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('device_model_id');
            $table->string('variant_key', 255);
            $table->string('name', 255);
            $table->string('ram_capacity_id')->nullable();
            $table->string('storage_capacity_id')->nullable();
            $table->string('region_code', 40)->nullable();
            $table->string('manufacturer_variant_code', 120)->nullable();
            $table->json('differences_json')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->unique(['device_model_id', 'variant_key'], 'device_model_variant_unique');
            $table->unique(['id', 'device_model_id'], 'device_model_variant_model_pair');
            $table->foreign('device_model_id')->references('id')->on('master_data_entries')->restrictOnDelete();
            $table->foreign('ram_capacity_id')->references('id')->on('master_data_entries')->restrictOnDelete();
            $table->foreign('storage_capacity_id')->references('id')->on('master_data_entries')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_model_variants');
    }
};
