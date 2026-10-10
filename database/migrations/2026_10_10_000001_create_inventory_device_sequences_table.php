<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_device_sequences', function (Blueprint $table): void {
            $table->unsignedTinyInteger('id')->primary();
            $table->unsignedBigInteger('next_number');
        });

        // Existing identifiers remain untouched. Reserve every already-used FXP number
        // before issuing new ones, even if previous records had gaps.
        $max = 0;
        foreach (DB::table('inventory_items')->where('sku', 'like', 'FXP-%')->pluck('sku') as $sku) {
            if (is_string($sku) && preg_match('/^FXP-([0-9]+)$/', $sku, $matches)) {
                $max = max($max, (int) $matches[1]);
            }
        }
        DB::table('inventory_device_sequences')->insert([
            'id' => 1,
            'next_number' => $max + 1,
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_device_sequences');
    }
};
