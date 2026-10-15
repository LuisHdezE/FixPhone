<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('own_repair_reference_prices', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->string('model', 160);
            $table->string('service_code', 32);
            $table->string('service_name', 160);
            $table->char('currency', 3);
            $table->unsignedBigInteger('price_minor');
            $table->text('notes')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->ulid('created_by');
            $table->ulid('updated_by');
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
            $table->unique(['model', 'service_code', 'service_name', 'currency'], 'own_repair_price_identity');
            $table->index(['model', 'service_code', 'archived_at'], 'own_repair_price_lookup');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('own_repair_reference_prices');
    }
};
