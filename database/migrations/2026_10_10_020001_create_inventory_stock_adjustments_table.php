<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_stock_adjustments', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('inventory_item_id')->constrained('inventory_items')->restrictOnDelete();
            $table->uuid('request_id')->unique();
            $table->integer('quantity_before');
            $table->integer('quantity_delta');
            $table->integer('quantity_after');
            $table->string('reason', 300);
            $table->ulid('actor_id');
            $table->timestamps();
            $table->index(['inventory_item_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_stock_adjustments');
    }
};
