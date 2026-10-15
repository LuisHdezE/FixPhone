<?php

namespace App\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;

final class AiPromptCatalogController extends Controller
{
    /** Prompt catalog is read-only until the separately approved CRUD stage. */
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => DB::table('ai_prompts')
                ->orderBy('description')
                ->limit(200)
                ->get(['code', 'description', 'updated_at']),
        ]);
    }

    public function show(string $code): JsonResponse
    {
        $prompt = DB::table('ai_prompts')
            ->where('code', $code)
            ->first(['code', 'description', 'content', 'updated_at']);

        abort_if($prompt === null, 404, 'No existe un prompt con ese código.');

        return response()->json(['data' => $prompt]);
    }
}
