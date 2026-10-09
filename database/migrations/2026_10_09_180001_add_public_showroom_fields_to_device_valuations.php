<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('device_valuations', function (Blueprint $table): void {
            $table->string('public_listing_status', 16)->default('draft')->index();
            $table->string('public_image_url', 2048)->nullable();
            $table->text('public_description')->nullable();
            $table->boolean('provenance_confirmed')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('device_valuations', function (Blueprint $table): void {
            $table->dropColumn(['public_listing_status', 'public_image_url', 'public_description', 'provenance_confirmed']);
        });
    }
};
