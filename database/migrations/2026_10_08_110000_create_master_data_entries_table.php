<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const KINDS = [
        'brands',
        'deviceModels',
        'categories',
        'colors',
        'storageCapacities',
        'ramCapacities',
        'conditions',
        'sparePartTypes',
    ];

    public function up(): void
    {
        Schema::create('master_data_entries', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('kind')->index();
            $table->json('payload');
            $table->timestamps();

            $table->unique(['kind', 'id']);
        });

        $path = database_path('seed-data/master-data.catalog.json');
        if (!is_file($path)) {
            throw new RuntimeException('Master data seed catalog not found: '.$path);
        }

        $catalog = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        $now = now();

        foreach (self::KINDS as $kind) {
            foreach (($catalog[$kind] ?? []) as $item) {
                if (!isset($item['id']) || !is_string($item['id'])) {
                    throw new RuntimeException("Master data item in {$kind} has no valid id.");
                }

                DB::table('master_data_entries')->updateOrInsert(
                    ['id' => $item['id']],
                    [
                        'kind' => $kind,
                        'payload' => json_encode($item, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
                );
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('master_data_entries');
    }
};
