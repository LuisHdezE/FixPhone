<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('device_installed_parts', function (Blueprint $table): void {
            $table->ulid('stock_adjustment_id')->nullable()->index();
        });
    }
    public function down(): void {
        Schema::table('device_installed_parts', function (Blueprint $table): void {
            $table->dropColumn('stock_adjustment_id');
        });
    }
};
