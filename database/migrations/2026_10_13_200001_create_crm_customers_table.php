<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('crm_customers', static function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->string('full_name', 255);
            $table->string('email', 255)->nullable();
            $table->string('phone', 60)->nullable();
            $table->string('relationship_state', 20)->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('full_name');
            $table->index('relationship_state');
            $table->index('phone');
            $table->unique('email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_customers');
    }
};
