<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('inventory_items', function (Blueprint $table): void {
            $table->string('component_identity_key', 64)->nullable()->unique();
        });
        Schema::create('device_extraction_batches', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->uuid('request_id')->unique();
            $table->foreignUlid('donor_item_id')->constrained('inventory_items')->restrictOnDelete();
            $table->string('request_hash', 64);
            $table->ulid('actor_id');
            $table->json('result');
            $table->timestamp('created_at');
        });
        Schema::create('device_part_extractions', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('batch_id')->constrained('device_extraction_batches')->restrictOnDelete();
            $table->foreignUlid('donor_item_id')->constrained('inventory_items')->restrictOnDelete();
            $table->foreignUlid('spare_item_id')->constrained('inventory_items')->restrictOnDelete();
            $table->string('part_type_id');
            $table->foreign('part_type_id')->references('id')->on('master_data_entries')->restrictOnDelete();
            $table->string('part_name');
            $table->string('part_condition', 20);
            $table->unsignedInteger('quantity_before');
            $table->unsignedInteger('quantity_after');
            $table->json('identity_snapshot');
            $table->timestamp('created_at');
            $table->unique(['donor_item_id', 'part_type_id'], 'donor_component_once');
        });
        // Extend the versioned catalogue without overwriting user-maintained entries.
        $catalog = json_decode(file_get_contents(database_path('seed-data/master-data.catalog.json')), true, 512, JSON_THROW_ON_ERROR);
        $ids = ['part-camera-front', 'part-camera-rear', 'part-charge-pin', 'part-charge-board', 'part-charge-flex', 'part-earpiece', 'part-back-cover', 'part-sim-tray', 'part-vibrator', 'part-power-flex'];
        foreach ($catalog['sparePartTypes'] as $type) {
            if (!in_array($type['id'], $ids, true)) continue;
            if ($type['parentId'] && !DB::table('master_data_entries')->where('id', $type['parentId'])->where('kind', 'sparePartTypes')->exists()) continue;
            DB::table('master_data_entries')->insertOrIgnore([
                'id' => $type['id'], 'kind' => 'sparePartTypes',
                'payload' => json_encode($type, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('device_part_extractions');
        Schema::dropIfExists('device_extraction_batches');
        Schema::table('inventory_items', fn (Blueprint $table) => $table->dropColumn('component_identity_key'));
    }
};
