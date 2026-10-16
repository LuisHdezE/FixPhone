<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('inventory_spare_part_sequences', function (Blueprint $table): void {
            $table->unsignedTinyInteger('id')->primary();
            $table->unsignedBigInteger('next_number');
        });
        $max = 0;
        foreach (DB::table('inventory_items')->where('sku', 'like', 'REP-%')->pluck('sku') as $sku) {
            if (is_string($sku) && preg_match('/^REP-([0-9]+)$/', $sku, $match)) {
                $max = max($max, (int) $match[1]);
            }
        }
        DB::table('inventory_spare_part_sequences')->insert(['id' => 1, 'next_number' => $max + 1]);
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_spare_part_sequences');
    }
};
