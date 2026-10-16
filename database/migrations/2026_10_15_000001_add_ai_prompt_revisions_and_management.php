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
        Schema::table('ai_prompts', function (Blueprint $table): void {
            $table->unsignedInteger('version')->default(1);
            $table->timestamp('archived_at')->nullable()->index();
        });

        Schema::create('ai_prompt_revisions', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->ulid('ai_prompt_id');
            $table->unsignedInteger('version');
            $table->string('description', 255);
            $table->longText('content');
            $table->string('action', 24);
            $table->ulid('actor_id')->nullable();
            $table->timestamp('created_at');
            $table->unique(['ai_prompt_id', 'version']);
            $table->foreign('ai_prompt_id')->references('id')->on('ai_prompts')->restrictOnDelete();
        });

        // Existing production prompts get a baseline historical snapshot.
        DB::table('ai_prompts')->orderBy('id')->chunk(100, function ($prompts): void {
            foreach ($prompts as $prompt) {
                DB::table('ai_prompt_revisions')->insert([
                    'id' => (string) Str::ulid(),
                    'ai_prompt_id' => $prompt->id,
                    'version' => 1,
                    'description' => $prompt->description,
                    'content' => $prompt->content,
                    'action' => 'baseline',
                    'actor_id' => null,
                    'created_at' => $prompt->updated_at ?? now(),
                ]);
            }
        });

        DB::table('permissions')->insertOrIgnore([
            'slug' => 'ai_prompts.manage',
            'name' => 'Create and maintain private AI prompts',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        foreach (['owner', 'administrator'] as $role) {
            DB::table('role_permissions')->insertOrIgnore([
                'role_slug' => $role,
                'permission_slug' => 'ai_prompts.manage',
            ]);
        }
    }

    public function down(): void
    {
        DB::table('role_permissions')->where('permission_slug', 'ai_prompts.manage')->delete();
        DB::table('permissions')->where('slug', 'ai_prompts.manage')->delete();
        Schema::dropIfExists('ai_prompt_revisions');
        Schema::table('ai_prompts', function (Blueprint $table): void {
            $table->dropColumn(['archived_at', 'version']);
        });
    }
};
