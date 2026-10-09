<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('device_valuations', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('inventory_item_id')->nullable()->unique()->constrained('inventory_items')->nullOnDelete();
            $table->string('model_name', 120);
            $table->string('fault_type', 32);
            $table->string('screen_condition', 32)->default('unknown');
            $table->string('power_state', 16)->default('unknown');
            $table->unsignedBigInteger('estimated_min_minor')->nullable();
            $table->unsignedBigInteger('estimated_max_minor')->nullable();
            $table->unsignedBigInteger('asking_price_minor')->nullable();
            $table->unsignedBigInteger('minimum_price_minor')->nullable();
            $table->string('publication_status', 24)->default('draft');
            $table->text('market_reference')->nullable();
            $table->text('notes')->nullable();
            $table->text('facebook_copy')->nullable();
            $table->string('facebook_post_url', 2048)->nullable();
            $table->ulid('created_by')->nullable();
            $table->timestamps();
            $table->index(['publication_status', 'updated_at']);
            $table->index(['model_name', 'fault_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_valuations');
    }
};
