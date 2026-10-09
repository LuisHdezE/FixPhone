<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('permissions')->insertOrIgnore([
            'slug' => 'valuation.manage',
            'name' => 'Manage individual device valuations and social drafts',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        foreach (['owner', 'administrator', 'sales_operator'] as $role) {
            DB::table('role_permissions')->insertOrIgnore([
                'role_slug' => $role,
                'permission_slug' => 'valuation.manage',
            ]);
        }
    }

    public function down(): void
    {
        DB::table('role_permissions')->where('permission_slug', 'valuation.manage')->delete();
        DB::table('permissions')->where('slug', 'valuation.manage')->delete();
    }
};
