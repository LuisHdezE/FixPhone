<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_storage_profiles', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->string('name', 120);
            $table->string('provider', 24);
            $table->string('bucket', 63);
            $table->string('endpoint_url', 2048);
            $table->string('public_base_url', 2048)->nullable();
            $table->string('object_prefix', 160)->default('media');
            $table->text('access_key_id_encrypted')->nullable();
            $table->text('secret_access_key_encrypted')->nullable();
            $table->boolean('is_selected')->default(false)->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_storage_profiles');
    }
};
