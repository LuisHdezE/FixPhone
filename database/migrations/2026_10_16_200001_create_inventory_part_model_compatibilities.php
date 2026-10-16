<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_part_model_compatibilities', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->ulid('inventory_item_id');
            $table->string('device_model_id', 255);
            $table->string('source', 32)->default('catalog');
            $table->timestamps();
            $table->unique(['inventory_item_id', 'device_model_id'], 'part_model_compat_unique');
            $table->index('device_model_id', 'part_model_compat_model_idx');
            $table->foreign('inventory_item_id')->references('id')->on('inventory_items')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_part_model_compatibilities');
    }
};
