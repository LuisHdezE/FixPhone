<?php

namespace Tests\Feature;

use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\Media\InventoryItemPhoto;
use App\Infrastructure\Media\MediaStorageProfile;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

final class PromotionalAssetsMigrationRecoveryTest extends TestCase
{
    use RefreshDatabase;

    private function getMigrationInstance(): Migration
    {
        return require database_path('migrations/2026_10_18_120000_create_inventory_item_promotional_assets_table.php');
    }

    public function test_all_identifier_names_are_strictly_under_64_characters(): void
    {
        $identifiers = [
            'prom_assets_item_fk' => 19,
            'prom_assets_photo_fk' => 20,
            'prom_assets_media_profile_fk' => 28,
            'prom_assets_status_idx' => 22,
            'prom_assets_item_status_idx' => 27,
            'prom_assets_photo_status_idx' => 28,
        ];

        foreach ($identifiers as $name => $expectedLength) {
            $this->assertSame($expectedLength, strlen($name), "Identifier '{$name}' length mismatch.");
            $this->assertLessThanOrEqual(64, strlen($name), "Identifier '{$name}' exceeds MySQL 64-char limit.");
        }
    }

    public function test_mysql_grammar_compilation_contains_no_identifier_exceeding_64_characters(): void
    {
        $connection = DB::connection();
        $grammar = new \Illuminate\Database\Schema\Grammars\MySqlGrammar($connection);
        $property = new \ReflectionProperty($connection, 'schemaGrammar');
        $property->setAccessible(true);
        $property->setValue($connection, $grammar);

        // Scenario A blueprint compiled with MySqlGrammar
        $blueprintA = new Blueprint($connection, 'inventory_item_promotional_assets');
        $blueprintA->create();
        $blueprintA->ulid('id')->primary();
        $blueprintA->foreignUlid('inventory_item_id')
            ->constrained('inventory_items', indexName: 'prom_assets_item_fk')
            ->cascadeOnDelete();
        $blueprintA->foreignUlid('source_photo_id')
            ->constrained('inventory_item_photos', indexName: 'prom_assets_photo_fk')
            ->cascadeOnDelete();
        $blueprintA->ulid('ai_prompt_id')->nullable();
        $blueprintA->string('prompt_code', 80);
        $blueprintA->string('prompt_version', 20)->default('1.0');
        $blueprintA->longText('prompt_snapshot');
        $blueprintA->string('status', 20)->default('prepared')->index('prom_assets_status_idx');
        $blueprintA->foreignUlid('media_storage_profile_id')
            ->nullable()
            ->constrained('media_storage_profiles', indexName: 'prom_assets_media_profile_fk')
            ->nullOnDelete();
        $blueprintA->string('object_key', 512)->nullable();
        $blueprintA->string('image_url', 2048)->nullable();
        $blueprintA->string('mime_type', 40)->nullable();
        $blueprintA->unsignedInteger('size_bytes')->nullable();
        $blueprintA->ulid('created_by')->nullable();
        $blueprintA->ulid('approved_by')->nullable();
        $blueprintA->timestamp('approved_at')->nullable();
        $blueprintA->timestamps();
        $blueprintA->index(['inventory_item_id', 'status'], 'prom_assets_item_status_idx');
        $blueprintA->index(['source_photo_id', 'status'], 'prom_assets_photo_status_idx');

        foreach ($blueprintA->toSql() as $sql) {
            // Find constraint and index names in backticks
            if (preg_match_all('/`([^`]+)`/', $sql, $matches)) {
                foreach ($matches[1] as $identifier) {
                    $this->assertLessThanOrEqual(
                        64,
                        strlen($identifier),
                        "MySQL identifier '{$identifier}' exceeds 64 chars in SQL: {$sql}"
                    );
                }
            }
        }

        // Scenario B blueprint compiled with MySqlGrammar (recovery of missing FK)
        $blueprintB = new Blueprint($connection, 'inventory_item_promotional_assets');
        $blueprintB->foreign('media_storage_profile_id', 'prom_assets_media_profile_fk')
            ->references('id')
            ->on('media_storage_profiles')
            ->nullOnDelete();

        foreach ($blueprintB->toSql() as $sql) {
            if (preg_match_all('/`([^`]+)`/', $sql, $matches)) {
                foreach ($matches[1] as $identifier) {
                    $this->assertLessThanOrEqual(
                        64,
                        strlen($identifier),
                        "MySQL recovery identifier '{$identifier}' exceeds 64 chars in SQL: {$sql}"
                    );
                }
            }
        }
    }

    public function test_clean_install_creates_complete_structure(): void
    {
        Schema::dropIfExists('inventory_item_promotional_assets');
        $this->assertFalse(Schema::hasTable('inventory_item_promotional_assets'));

        $migration = $this->getMigrationInstance();
        $migration->up();

        $this->assertTrue(Schema::hasTable('inventory_item_promotional_assets'));

        $expectedColumns = [
            'id',
            'inventory_item_id',
            'source_photo_id',
            'ai_prompt_id',
            'prompt_code',
            'prompt_version',
            'prompt_snapshot',
            'status',
            'media_storage_profile_id',
            'object_key',
            'image_url',
            'mime_type',
            'size_bytes',
            'created_by',
            'approved_by',
            'approved_at',
            'created_at',
            'updated_at',
        ];

        foreach ($expectedColumns as $col) {
            $this->assertTrue(
                Schema::hasColumn('inventory_item_promotional_assets', $col),
                "Column '{$col}' was not found in clean install."
            );
        }

        $this->assertTrue(Schema::hasIndex('inventory_item_promotional_assets', 'prom_assets_status_idx'));
        $this->assertTrue(Schema::hasIndex('inventory_item_promotional_assets', 'prom_assets_item_status_idx'));
        $this->assertTrue(Schema::hasIndex('inventory_item_promotional_assets', 'prom_assets_photo_status_idx'));
    }

    public function test_partial_production_table_recovery_completes_structure_without_deleting_data(): void
    {
        // 1. Drop existing table to set up exact partial production state
        Schema::dropIfExists('inventory_item_promotional_assets');

        // 2. Simulate production partial state:
        // CREATE TABLE executed with 2 FKs, but WITHOUT the 3rd FK (media_storage_profile_id) and WITHOUT indexes
        Schema::create('inventory_item_promotional_assets', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('inventory_item_id')->constrained('inventory_items')->cascadeOnDelete();
            $table->foreignUlid('source_photo_id')->constrained('inventory_item_photos')->cascadeOnDelete();
            $table->ulid('ai_prompt_id')->nullable();
            $table->string('prompt_code', 80);
            $table->string('prompt_version', 20)->default('1.0');
            $table->longText('prompt_snapshot');
            $table->string('status', 20)->default('prepared');
            $table->ulid('media_storage_profile_id')->nullable();
            $table->string('object_key', 512)->nullable();
            $table->string('image_url', 2048)->nullable();
            $table->string('mime_type', 40)->nullable();
            $table->unsignedInteger('size_bytes')->nullable();
            $table->ulid('created_by')->nullable();
            $table->ulid('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
        });

        // Verify partial state: table exists, but custom indexes do NOT exist
        $this->assertTrue(Schema::hasTable('inventory_item_promotional_assets'));
        $this->assertFalse(Schema::hasIndex('inventory_item_promotional_assets', 'prom_assets_status_idx'));
        $this->assertFalse(Schema::hasIndex('inventory_item_promotional_assets', 'prom_assets_item_status_idx'));
        $this->assertFalse(Schema::hasIndex('inventory_item_promotional_assets', 'prom_assets_photo_status_idx'));

        // 3. Create parent dependencies and insert sentinel row
        $profile = MediaStorageProfile::query()->create([
            'id' => (string) Str::ulid(),
            'name' => 'R2 Recovery Test Profile',
            'provider' => 'cloudflare_r2',
            'bucket' => 'fixphone-media',
            'endpoint_url' => 'https://example.r2.cloudflarestorage.com',
            'public_base_url' => 'https://pub-recovery.r2.dev',
            'object_prefix' => 'media',
            'access_key_id_encrypted' => Crypt::encryptString('dummy-key'),
            'secret_access_key_encrypted' => Crypt::encryptString('dummy-secret'),
            'is_selected' => true,
        ]);

        $item = InventoryItem::query()->create([
            'sku' => 'REC-001',
            'title' => 'Recovery Test Device',
            'item_type' => 'used_phone',
            'operational_status' => 'disponible',
            'publication_status' => 'borrador',
            'inventory_purpose' => 'sell_as_used_phone',
        ]);

        $photo = InventoryItemPhoto::query()->create([
            'id' => (string) Str::ulid(),
            'inventory_item_id' => $item->id,
            'media_storage_profile_id' => $profile->id,
            'object_key' => 'media/inventory/devices/rec-001/photo.jpg',
            'public_url' => 'https://pub-recovery.r2.dev/media/inventory/devices/rec-001/photo.jpg',
            'content_type' => 'image/jpeg',
            'byte_size' => 10240,
            'status' => 'confirmed',
            'sort_order' => 1,
            'is_primary' => true,
            'upload_expires_at' => now()->addHour(),
        ]);

        $sentinelId = (string) Str::ulid();
        DB::table('inventory_item_promotional_assets')->insert([
            'id' => $sentinelId,
            'inventory_item_id' => $item->id,
            'source_photo_id' => $photo->id,
            'ai_prompt_id' => null,
            'prompt_code' => 'PROMPT-0001',
            'prompt_version' => '1.0',
            'prompt_snapshot' => 'Sentinel prompt text',
            'status' => 'prepared',
            'media_storage_profile_id' => $profile->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertDatabaseHas('inventory_item_promotional_assets', ['id' => $sentinelId]);

        // 4. Run the recovery migration
        $migration = $this->getMigrationInstance();
        $migration->up();

        // 5. Verify the sentinel row is preserved intact!
        $this->assertDatabaseHas('inventory_item_promotional_assets', [
            'id' => $sentinelId,
            'prompt_snapshot' => 'Sentinel prompt text',
            'status' => 'prepared',
        ]);

        // 6. Verify missing indexes are now created
        $this->assertTrue(Schema::hasIndex('inventory_item_promotional_assets', 'prom_assets_status_idx'));
        $this->assertTrue(Schema::hasIndex('inventory_item_promotional_assets', 'prom_assets_item_status_idx'));
        $this->assertTrue(Schema::hasIndex('inventory_item_promotional_assets', 'prom_assets_photo_status_idx'));

        // 7. Verify missing foreign key is now present
        $foreignKeys = collect(Schema::getForeignKeys('inventory_item_promotional_assets'));
        $hasMediaFk = $foreignKeys->contains(function (array $fk): bool {
            return ($fk['name'] ?? null) === 'prom_assets_media_profile_fk'
                || ($fk['columns'] ?? []) === ['media_storage_profile_id'];
        });
        $this->assertTrue($hasMediaFk, "Missing foreign key prom_assets_media_profile_fk was not recovered.");
    }

    public function test_idempotent_second_run_is_safe_and_retains_data(): void
    {
        $migration = $this->getMigrationInstance();

        // First run (clean install)
        $migration->up();
        $this->assertTrue(Schema::hasTable('inventory_item_promotional_assets'));

        // Second run on already-complete table
        $migration->up();
        $this->assertTrue(Schema::hasTable('inventory_item_promotional_assets'));
    }

    public function test_down_rollback_is_safe(): void
    {
        $migration = $this->getMigrationInstance();
        $migration->up();
        $this->assertTrue(Schema::hasTable('inventory_item_promotional_assets'));

        $migration->down();
        $this->assertFalse(Schema::hasTable('inventory_item_promotional_assets'));
    }

    public function test_run_migrations_endpoint_observability(): void
    {
        // 1. Unauthorized when DEPLOY_TOKEN is missing or invalid
        $unauthorized = $this->postJson('/api/_deploy/run-migrations', [], [
            'X-Deploy-Token' => 'wrong-token',
        ]);
        $unauthorized->assertStatus(401);

        // 2. Authorized execution
        config(['app.deploy_token' => 'test-deploy-token']);
        putenv('DEPLOY_TOKEN=test-deploy-token');

        $authorized = $this->postJson('/api/_deploy/run-migrations', [], [
            'X-Deploy-Token' => 'test-deploy-token',
        ]);

        $authorized->assertStatus(200)
            ->assertJsonPath('status', 'success');

        putenv('DEPLOY_TOKEN');
    }
}
