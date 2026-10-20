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
            $table->string('payment_review_reason', 100)->nullable();
            $table->string('mercadopago_merchant_order_id', 40)->nullable()->index();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('payment_checked_at')->nullable();
        });

        Schema::table('inventory_stock_adjustments', function (Blueprint $table): void {
            $table->string('source_type', 40)->nullable()->after('reason');
            $table->string('source_id', 80)->nullable()->after('source_type');
            $table->unique(['source_type', 'source_id', 'inventory_item_id'], 'inventory_adjustment_source_unique');
        });

        Schema::create('storefront_payment_preferences', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('order_id')->unique()->constrained('storefront_orders')->cascadeOnDelete();
            $table->string('external_reference', 80)->unique();
            $table->string('preference_id', 100)->nullable()->unique();
            $table->string('client_id', 40)->nullable();
            $table->string('collector_id', 40)->nullable();
            $table->string('status', 30);
            $table->unsignedInteger('attempt_count')->default(0);
            $table->text('checkout_url')->nullable();
            $table->char('request_payload_hash', 64);
            $table->char('response_payload_hash', 64)->nullable();
            $table->string('last_error_class', 190)->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('storefront_payment_attempts', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('order_id')->constrained('storefront_orders')->cascadeOnDelete();
            $table->string('payment_id', 40)->unique();
            $table->string('preference_id', 100);
            $table->string('merchant_order_id', 40);
            $table->string('application_id', 40);
            $table->string('status', 40);
            $table->string('status_detail', 100)->nullable();
            $table->unsignedBigInteger('amount_minor');
            $table->char('currency_code', 3);
            $table->string('collector_id', 40);
            $table->string('payment_method_id', 80)->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('provider_updated_at')->nullable();
            $table->char('provider_payload_hash', 64);
            $table->timestamps();
            $table->index(['order_id', 'created_at']);
            $table->index(['merchant_order_id', 'created_at']);
        });

        Schema::create('mercadopago_notifications', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->string('request_id', 120)->unique();
            $table->string('provider_notification_id', 80)->nullable();
            $table->string('topic', 60);
            $table->string('action', 100)->nullable();
            $table->string('resource_id', 80);
            $table->string('application_id', 40)->nullable();
            $table->boolean('live_mode')->nullable();
            $table->json('payload');
            $table->char('payload_hash', 64);
            $table->unsignedInteger('attempts')->default(0);
            $table->timestamp('received_at');
            $table->timestamp('available_at');
            $table->timestamp('processing_started_at')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();
            $table->index(['processed_at', 'available_at']);
            $table->index(['topic', 'resource_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mercadopago_notifications');
        Schema::dropIfExists('storefront_payment_attempts');
        Schema::dropIfExists('storefront_payment_preferences');

        Schema::table('inventory_stock_adjustments', function (Blueprint $table): void {
            $table->dropUnique('inventory_adjustment_source_unique');
            $table->dropColumn(['source_type', 'source_id']);
        });

        Schema::table('storefront_orders', function (Blueprint $table): void {
            $table->dropUnique(['mercadopago_preference_id']);
            $table->dropColumn([
                'mercadopago_preference_id',
                'mercadopago_checkout_url',
                'mercadopago_preference_started_at',
                'payment_status',
                'payment_status_detail',
                'payment_review_reason',
                'mercadopago_merchant_order_id',
                'paid_at',
                'payment_checked_at',
            ]);
        });
    }
};
