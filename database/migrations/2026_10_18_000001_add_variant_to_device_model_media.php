<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Additive: lets a generic image belong to one specific variant. A NULL variant
 * keeps the historical meaning "image of the whole model".
 *
 * Deletion policy: RESTRICT, never CASCADE. Cascading would silently drop rows
 * that point at R2 objects, leaving orphan files nobody references. Removal is
 * a deliberate, deferred and auditable process (PR 2), not a side effect.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('device_model_media', function (Blueprint $table) {
            $table->ulid('device_model_variant_id')->nullable()->after('device_model_id');
            $table->index(['device_model_variant_id', 'sort_order'], 'device_model_media_variant_sort_idx');
            // Pair FK guarantees at database level that the variant belongs to the same model.
            $table->foreign(['device_model_variant_id', 'device_model_id'], 'device_model_media_variant_model_fk')
                ->references(['id', 'device_model_id'])->on('device_model_variants')->restrictOnDelete();
        });
    }

    /**
     * Rolling back would either delete variant images or reinterpret them as
     * model-wide images. Both are silent data changes, so refuse and make the
     * operator decide explicitly.
     */
    public function down(): void
    {
        if (DB::table('device_model_media')->whereNotNull('device_model_variant_id')->exists()) {
            throw new RuntimeException(
                'Rollback bloqueado: existen imágenes asociadas a variantes. Exportalas o reasignalas manualmente antes de revertir; no se pierden ni reinterpretan datos de forma automática.'
            );
        }

        Schema::table('device_model_media', function (Blueprint $table) {
            $table->dropForeign(['device_model_variant_id', 'device_model_id']);
            $table->dropIndex('device_model_media_variant_sort_idx');
            $table->dropColumn('device_model_variant_id');
        });
    }
};
