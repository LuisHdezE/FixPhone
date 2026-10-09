<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('repair_quotes', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->string('customer_name', 160)->nullable();
            $table->string('customer_contact', 160)->nullable();
            $table->string('device_description', 240)->nullable();
            $table->string('device_tier', 16);
            $table->json('services');
            $table->json('parts');
            $table->unsignedTinyInteger('parts_markup_percent');
            $table->unsignedBigInteger('services_subtotal_minor');
            $table->unsignedBigInteger('parts_base_minor');
            $table->unsignedBigInteger('parts_total_minor');
            $table->unsignedBigInteger('courier_minor');
            $table->unsignedBigInteger('discount_minor');
            $table->unsignedBigInteger('total_minor');
            $table->string('currency_code', 3)->default('UYU');
            $table->text('notes')->nullable();
            $table->ulid('created_by');
            $table->timestamps();
            $table->index(['created_at', 'device_tier']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('repair_quotes');
    }
};
