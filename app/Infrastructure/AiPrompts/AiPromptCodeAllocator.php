<?php

namespace App\Infrastructure\AiPrompts;

use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Allocate an immutable, sequential code for an AI prompt (PROMPT-0001, PROMPT-0002, ...).
 *
 * Must be invoked inside the same DB transaction that creates the prompt.
 * Row-level locking on the sequence counter prevents duplicate codes under concurrent intake.
 * Archiving or deleting a prompt never allows its number to be reused.
 */
final class AiPromptCodeAllocator
{
    public static function reserve(): string
    {
        $row = DB::table('ai_prompt_sequences')
            ->where('id', 1)
            ->lockForUpdate()
            ->first();

        if ($row === null) {
            // Self-healing fallback if seed/test environment missed the row
            DB::table('ai_prompt_sequences')->insertOrIgnore(['id' => 1, 'next_number' => 1]);
            $row = DB::table('ai_prompt_sequences')->where('id', 1)->lockForUpdate()->first();
            if ($row === null) {
                throw new RuntimeException('El contador de secuencias de prompts no está inicializado.');
            }
        }

        $next = (int) $row->next_number;
        do {
            $code = sprintf('PROMPT-%04d', $next);
            $next++;
        } while (DB::table('ai_prompts')->where('code', $code)->exists());

        DB::table('ai_prompt_sequences')
            ->where('id', 1)
            ->update(['next_number' => $next]);

        return $code;
    }
}
