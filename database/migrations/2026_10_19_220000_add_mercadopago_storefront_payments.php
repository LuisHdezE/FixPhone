<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('storefront_orders', function (Blueprint $table): void {
            $table->string('mercadopago_preference_id', 100)->nullable()->unique();
            $table->text('mercadopago_checkout_url')->nullable();
            $table->timestamp('mercadopago_preference_started_at')->nullable();
            $table->string('payment_status', 40)->nullable();
            $table->string('payment_status_detail', 100)->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('payment_checked_at')->nullable();
        });

        Schema::create('storefront_payment_attempts', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('order_id')->constrained('storefront_orders')->cascadeOnDelete();
            $table->string('payment_id', 40)->unique();
            $table->string('preference_id', 100);
            $table->string('status', 40);
            $table->string('status_detail', 100)->nullable();
            $table->unsignedBigInteger('amount_minor');
            $table->char('currency_code', 3);
            $table->string('collector_id', 40);
            $table->string('payment_method_id', 80)->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->char('provider_payload_hash', 64);
            $table->timestamps();
            $table->index(['order_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('storefront_payment_attempts');

        Schema::table('storefront_orders', function (Blueprint $table): void {
            $table->dropUnique(['mercadopago_preference_id']);
            $table->dropColumn([
                'mercadopago_preference_id',
                'mercadopago_checkout_url',
                'mercadopago_preference_started_at',
                'payment_status',
                'payment_status_detail',
                'paid_at',
                'payment_checked_at',
            ]);
        });
    }
};
