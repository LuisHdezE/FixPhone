<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('device_installed_parts', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('inventory_item_id');
            $table->ulid('spare_part_item_id')->nullable();
            $table->string('part_name');
            $table->integer('cost_amount_minor');
            $table->string('currency_code', 3)->default('UYU');
            $table->timestamp('installed_at');
            $table->string('installed_by_actor_id');
            $table->text('notes')->nullable();

            $table->timestamp('voided_at')->nullable();
            $table->string('voided_by_actor_id')->nullable();
            $table->string('void_reason')->nullable();

            $table->uuid('request_id')->nullable()->unique();

            $table->timestamps();

            $table->foreign('inventory_item_id')
                ->references('id')
                ->on('inventory_items')
                ->onDelete('restrict');

            $table->foreign('spare_part_item_id')
                ->references('id')
                ->on('inventory_items')
                ->onDelete('set null');

            $table->index(['inventory_item_id', 'installed_at']);
            $table->index('installed_at');
            $table->index('voided_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_installed_parts');
    }
};
