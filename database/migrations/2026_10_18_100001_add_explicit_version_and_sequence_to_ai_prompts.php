<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_prompt_sequences', function (Blueprint $table): void {
            $table->unsignedInteger('id')->primary();
            $table->unsignedBigInteger('next_number');
        });

        $maxPromptNumber = 0;
        if (Schema::hasTable('ai_prompts')) {
            $existingCodes = DB::table('ai_prompts')->pluck('code');
            foreach ($existingCodes as $code) {
                if (preg_match('/^PROMPT-(\d+)$/', (string) $code, $matches)) {
                    $num = (int) $matches[1];
                    if ($num > $maxPromptNumber) {
                        $maxPromptNumber = $num;
                    }
                }
            }
        }

        DB::table('ai_prompt_sequences')->insert([
            'id' => 1,
            'next_number' => $maxPromptNumber + 1,
        ]);

        Schema::table('ai_prompts', function (Blueprint $table): void {
            $table->renameColumn('version', 'lock_version');
        });

        Schema::table('ai_prompts', function (Blueprint $table): void {
            $table->string('version', 20)->default('1.0')->after('description');
        });

        DB::table('ai_prompts')
            ->whereNull('version')
            ->orWhere('version', '')
            ->update(['version' => '1.0']);

        if (Schema::hasTable('ai_prompt_revisions')) {
            Schema::table('ai_prompt_revisions', function (Blueprint $table): void {
                $table->string('prompt_version', 20)->default('1.0')->after('version');
            });
            DB::table('ai_prompt_revisions')
                ->whereNull('prompt_version')
                ->orWhere('prompt_version', '')
                ->update(['prompt_version' => '1.0']);
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('ai_prompt_revisions')) {
            Schema::table('ai_prompt_revisions', function (Blueprint $table): void {
                $table->dropColumn('prompt_version');
            });
        }

        Schema::table('ai_prompts', function (Blueprint $table): void {
            $table->dropColumn('version');
        });

        Schema::table('ai_prompts', function (Blueprint $table): void {
            $table->renameColumn('lock_version', 'version');
        });

        Schema::dropIfExists('ai_prompt_sequences');
    }
};
