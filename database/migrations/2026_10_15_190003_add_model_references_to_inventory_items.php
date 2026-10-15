<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->string('device_model_id')->nullable()->index();
            $table->ulid('device_model_variant_id')->nullable()->index();
            $table->foreign('device_model_id')->references('id')->on('master_data_entries')->restrictOnDelete();
            $table->foreign('device_model_variant_id')->references('id')->on('device_model_variants')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropForeign(['device_model_variant_id']);
            $table->dropForeign(['device_model_id']);
            $table->dropColumn(['device_model_variant_id', 'device_model_id']);
        });
    }
};
