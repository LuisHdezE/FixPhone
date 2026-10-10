<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('device_sale_records', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('inventory_item_id');
            $table->bigInteger('effective_sale_price_minor');
            $table->bigInteger('initial_cost_amount_minor')->nullable();
            $table->bigInteger('installed_parts_cost_minor')->default(0);
            $table->string('currency_code', 3)->default('UYU');

            $table->string('inventory_purpose');
            $table->string('consignor_name')->nullable();

            $table->timestamp('sold_at');
            $table->string('sold_by_actor_id');
            $table->string('receipt_number')->nullable();
            $table->text('notes')->nullable();

            $table->string('status', 30)->default('completed');
            $table->timestamp('voided_at')->nullable();
            $table->string('voided_by_actor_id')->nullable();
            $table->string('void_reason')->nullable();
            $table->boolean('return_to_inventory')->default(true);

            $table->uuid('request_id')->nullable()->unique();

            $table->timestamps();

            $table->foreign('inventory_item_id')
                ->references('id')
                ->on('inventory_items')
                ->onDelete('restrict');

            $table->index(['inventory_item_id', 'sold_at']);
            $table->index('sold_at');
            $table->index('inventory_purpose');
            $table->index('voided_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_sale_records');
    }
};
