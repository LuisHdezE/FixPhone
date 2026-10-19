<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('storefront_orders', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->string('order_number', 30)->unique();
            $table->foreignUlid('user_id')->constrained('users')->restrictOnDelete();
            $table->string('customer_name', 120);
            $table->string('customer_email', 254);
            $table->string('status', 30)->default('awaiting_payment');
            $table->char('currency_code', 3)->default('UYU');
            $table->unsignedBigInteger('total_amount_minor');
            $table->string('external_reference', 80)->unique();
            $table->char('idempotency_key_hash', 64);
            $table->char('cart_fingerprint', 64);
            $table->timestamp('reservation_expires_at');
            $table->timestamp('stock_deducted_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'idempotency_key_hash']);
            $table->index(['user_id', 'created_at']);
            $table->index(['status', 'reservation_expires_at']);
        });

        Schema::create('storefront_order_items', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('order_id')->constrained('storefront_orders')->cascadeOnDelete();
            $table->foreignUlid('inventory_item_id')->constrained('inventory_items')->restrictOnDelete();
            $table->string('sku_snapshot', 100)->nullable();
            $table->string('title_snapshot', 255);
            $table->unsignedInteger('quantity');
            $table->unsignedBigInteger('unit_price_minor');
            $table->unsignedBigInteger('line_total_minor');
            $table->timestamps();
            $table->unique(['order_id', 'inventory_item_id']);
            $table->index('inventory_item_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('storefront_order_items');
        Schema::dropIfExists('storefront_orders');
    }
};
