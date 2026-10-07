<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('sku')->nullable()->unique();
            $table->string('title');
            $table->text('description')->nullable();

            $table->string('item_type');

            $table->string('brand')->nullable();
            $table->string('model')->nullable();

            $table->string('operational_status');
            $table->string('publication_status');
            $table->string('inventory_purpose');

            $table->boolean('is_sellable')->default(false);
            $table->integer('stock_quantity')->default(0);

            $table->integer('cost_amount_minor')->nullable();
            $table->integer('sale_price_amount_minor')->nullable();
            $table->string('currency_code')->default('UYU');

            $table->string('main_image_url')->nullable();

            $table->string('social_publish_status')->nullable();
            $table->boolean('auto_publish_to_social')->default(false);

            $table->json('metadata')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_items');
    }
};
