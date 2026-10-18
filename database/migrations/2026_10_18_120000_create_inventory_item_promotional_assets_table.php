<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('inventory_item_promotional_assets')) {
            // Scenario A: Clean install on fresh or unmigrated database
            Schema::create('inventory_item_promotional_assets', function (Blueprint $table): void {
                $table->ulid('id')->primary();
                $table->foreignUlid('inventory_item_id')
                    ->constrained('inventory_items', indexName: 'prom_assets_item_fk')
                    ->cascadeOnDelete();
                $table->foreignUlid('source_photo_id')
                    ->constrained('inventory_item_photos', indexName: 'prom_assets_photo_fk')
                    ->cascadeOnDelete();
                $table->ulid('ai_prompt_id')->nullable();
                $table->string('prompt_code', 80);
                $table->string('prompt_version', 20)->default('1.0');
                $table->longText('prompt_snapshot');
                $table->string('status', 20)->default('prepared')->index('prom_assets_status_idx');
                $table->foreignUlid('media_storage_profile_id')
                    ->nullable()
                    ->constrained('media_storage_profiles', indexName: 'prom_assets_media_profile_fk')
                    ->nullOnDelete();
                $table->string('object_key', 512)->nullable();
                $table->string('image_url', 2048)->nullable();
                $table->string('mime_type', 40)->nullable();
                $table->unsignedInteger('size_bytes')->nullable();
                $table->ulid('created_by')->nullable();
                $table->ulid('approved_by')->nullable();
                $table->timestamp('approved_at')->nullable();
                $table->timestamps();

                $table->index(['inventory_item_id', 'status'], 'prom_assets_item_status_idx');
                $table->index(['source_photo_id', 'status'], 'prom_assets_photo_status_idx');
            });

            return;
        }

        // Scenario B: Recovery of partially applied table in production
        // Complete missing foreign key and indexes without destroying existing data or table
        if (!Schema::hasColumn('inventory_item_promotional_assets', 'media_storage_profile_id')) {
            Schema::table('inventory_item_promotional_assets', function (Blueprint $table): void {
                $table->ulid('media_storage_profile_id')->nullable();
            });
        }

        $existingForeignKeys = collect(Schema::getForeignKeys('inventory_item_promotional_assets'));
        $hasMediaStorageFk = $existingForeignKeys->contains(function (array $fk): bool {
            return ($fk['name'] ?? null) === 'prom_assets_media_profile_fk'
                || ($fk['columns'] ?? []) === ['media_storage_profile_id'];
        });

        if (!$hasMediaStorageFk) {
            Schema::table('inventory_item_promotional_assets', function (Blueprint $table): void {
                $table->foreign('media_storage_profile_id', 'prom_assets_media_profile_fk')
                    ->references('id')
                    ->on('media_storage_profiles')
                    ->nullOnDelete();
            });
        }

        $existingIndexes = collect(Schema::getIndexes('inventory_item_promotional_assets'));
        $hasStatusIndex = $existingIndexes->contains(function (array $idx): bool {
            return ($idx['name'] ?? null) === 'prom_assets_status_idx'
                || ($idx['columns'] ?? []) === ['status'];
        });
        $hasItemStatusIndex = $existingIndexes->contains(function (array $idx): bool {
            return ($idx['name'] ?? null) === 'prom_assets_item_status_idx'
                || ($idx['columns'] ?? []) === ['inventory_item_id', 'status'];
        });
        $hasPhotoStatusIndex = $existingIndexes->contains(function (array $idx): bool {
            return ($idx['name'] ?? null) === 'prom_assets_photo_status_idx'
                || ($idx['columns'] ?? []) === ['source_photo_id', 'status'];
        });

        if (!$hasStatusIndex || !$hasItemStatusIndex || !$hasPhotoStatusIndex) {
            Schema::table('inventory_item_promotional_assets', function (Blueprint $table) use (
                $hasStatusIndex,
                $hasItemStatusIndex,
                $hasPhotoStatusIndex
            ): void {
                if (!$hasStatusIndex) {
                    $table->index('status', 'prom_assets_status_idx');
                }
                if (!$hasItemStatusIndex) {
                    $table->index(['inventory_item_id', 'status'], 'prom_assets_item_status_idx');
                }
                if (!$hasPhotoStatusIndex) {
                    $table->index(['source_photo_id', 'status'], 'prom_assets_photo_status_idx');
                }
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_item_promotional_assets');
    }
};
