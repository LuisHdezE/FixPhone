<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('orders', static function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->string('order_number', 30)->unique();
            $table->ulid('customer_id');
            $table->string('customer_name_snapshot', 255);
            $table->string('status', 25)->default('pending');
            $table->char('currency_code', 3)->default('UYU');
            $table->bigInteger('total_amount_minor')->default(0);
            $table->text('notes')->nullable();
            $table->string('created_by_actor_id', 50);
            $table->string('updated_by_actor_id', 50)->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancelled_by_actor_id', 50)->nullable();
            $table->string('cancel_reason', 300)->nullable();
            $table->timestamps();
            $table->foreign('customer_id')->references('id')->on('crm_customers')->restrictOnDelete();
            $table->index(['status', 'created_at']);
            $table->index(['customer_id', 'created_at']);
        });

        Schema::create('order_items', static function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->ulid('order_id');
            $table->ulid('inventory_item_id');
            $table->string('item_sku_snapshot', 100)->nullable();
            $table->string('item_name_snapshot', 255);
            $table->string('item_type_snapshot', 60);
            $table->unsignedInteger('quantity');
            $table->bigInteger('unit_price_minor');
            $table->bigInteger('line_total_minor');
            $table->timestamps();
            $table->foreign('order_id')->references('id')->on('orders')->restrictOnDelete();
            $table->foreign('inventory_item_id')->references('id')->on('inventory_items')->restrictOnDelete();
            $table->unique(['order_id', 'inventory_item_id']);
            $table->index('inventory_item_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
