<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('storefront_campaigns', function (Blueprint $table): void {
            $table->unsignedTinyInteger('id')->primary();
            $table->json('slides');
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('storefront_campaigns'); }
};
