<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('device_technical_evaluations', static function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->ulid('inventory_item_id');
            $table->unsignedInteger('revision');
            $table->uuid('request_id')->unique();
            $table->string('device_sku_snapshot', 100)->nullable();
            $table->string('device_title_snapshot', 255);
            $table->string('overall_result', 20);
            $table->text('notes')->nullable();
            $table->string('evaluated_by_actor_id', 50);
            $table->timestamps();
            $table->foreign('inventory_item_id')->references('id')->on('inventory_items')->restrictOnDelete();
            $table->unique(['inventory_item_id', 'revision']);
            $table->index(['inventory_item_id', 'created_at']);
        });

        Schema::create('device_technical_checks', static function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->ulid('evaluation_id');
            $table->string('check_key', 40);
            $table->string('result', 20);
            $table->string('notes', 800)->nullable();
            $table->foreign('evaluation_id')->references('id')->on('device_technical_evaluations')->restrictOnDelete();
            $table->unique(['evaluation_id', 'check_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_technical_checks');
        Schema::dropIfExists('device_technical_evaluations');
    }
};
