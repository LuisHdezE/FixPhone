<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('permissions')->insertOrIgnore([
            'slug' => 'repair_quotes.manage',
            'name' => 'Create and view FixPhone repair estimates',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        foreach (['owner', 'administrator', 'sales_operator'] as $role) {
            DB::table('role_permissions')->insertOrIgnore([
                'role_slug' => $role, 'permission_slug' => 'repair_quotes.manage',
            ]);
        }
    }

    public function down(): void
    {
        DB::table('role_permissions')->where('permission_slug', 'repair_quotes.manage')->delete();
        DB::table('permissions')->where('slug', 'repair_quotes.manage')->delete();
    }
};
