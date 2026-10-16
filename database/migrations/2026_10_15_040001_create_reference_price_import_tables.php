<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reference_price_import_batches', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->string('file_name', 180);
            $table->char('file_sha256', 64);
            $table->ulid('created_by');
            $table->string('status', 16)->default('pending');
            $table->unsignedInteger('total_rows');
            $table->unsignedInteger('inserted_rows')->default(0);
            $table->unsignedInteger('duplicate_rows')->default(0);
            // Validated snapshot, not the original upload, used at confirmation.
            $table->longText('validated_rows')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('committed_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'created_at']);
            $table->index(['created_by', 'created_at']);
        });

        Schema::create('reference_price_observations', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->ulid('import_batch_id');
            $table->char('row_sha256', 64)->unique();
            $table->string('source', 24);
            $table->char('source_country', 2);
            $table->string('source_url', 2048);
            $table->date('observed_date');
            $table->string('brand', 60);
            $table->string('model', 160);
            $table->string('service_code', 32);
            $table->string('service_name', 160);
            $table->char('currency', 3);
            $table->unsignedBigInteger('price_minor');
            $table->unsignedTinyInteger('minor_digits');
            $table->string('tax_included', 8);
            $table->string('price_type', 32);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->foreign('import_batch_id')->references('id')->on('reference_price_import_batches')->restrictOnDelete();
            $table->index(['source', 'model', 'service_code', 'observed_date'], 'reference_price_lookup');
        });

        DB::table('permissions')->insertOrIgnore([
            'slug' => 'reference_prices.import',
            'name' => 'Import published reference repair prices',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        foreach (['owner', 'administrator'] as $role) {
            DB::table('role_permissions')->insertOrIgnore([
                'role_slug' => $role,
                'permission_slug' => 'reference_prices.import',
            ]);
        }
    }

    public function down(): void
    {
        DB::table('role_permissions')->where('permission_slug', 'reference_prices.import')->delete();
        DB::table('permissions')->where('slug', 'reference_prices.import')->delete();
        Schema::dropIfExists('reference_price_observations');
        Schema::dropIfExists('reference_price_import_batches');
    }
};
