<?php

namespace App\Presentation\Http\Controllers;

use App\Application\Authorization\Contracts\AuthorizationGateway;
use App\Infrastructure\AiPrompts\AiPromptCodeAllocator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class AiPromptCatalogController extends Controller
{
    public function __construct(private readonly AuthorizationGateway $authorization) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => DB::table('ai_prompts')
                ->orderBy('description')->limit(500)
                ->get(['code', 'description', 'version', 'lock_version', 'archived_at', 'updated_at']),
            'can_manage' => $this->authorization->hasPermission(
                (string) $request->user()->getAuthIdentifier(), 'ai_prompts.manage'
            ),
        ]);
    }

    public function show(string $code): JsonResponse
    {
        return response()->json(['data' => $this->findPrompt($code)]);
    }

    public function history(string $code): JsonResponse
    {
        $prompt = $this->findPrompt($code);
        return response()->json([
            'data' => DB::table('ai_prompt_revisions')
                ->where('ai_prompt_id', $prompt->id)
                ->orderByDesc('version')
                ->get(['version', 'prompt_version', 'description', 'action', 'actor_id', 'created_at']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['prohibited'],
            'description' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string', 'max:100000'],
            'version' => ['nullable', 'string', 'max:20', 'regex:/^v?[0-9]+(\.[0-9]+)*$/'],
        ], [
            'code.prohibited' => 'El código se autogenera en el servidor y no debe ser enviado por el cliente.',
            'version.regex' => 'El formato de versión no es válido (ejemplo: 1.0).',
        ]);

        $promptVersion = isset($data['version']) && trim((string) $data['version']) !== ''
            ? ltrim(trim((string) $data['version']), 'vV')
            : '1.0';

        $prompt = DB::transaction(function () use ($data, $promptVersion, $request) {
            $code = AiPromptCodeAllocator::reserve();
            $id = (string) Str::ulid();
            $record = [
                'id' => $id,
                'code' => $code,
                'description' => trim($data['description']),
                'version' => $promptVersion,
                'lock_version' => 1,
                'content' => $data['content'],
                'archived_at' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ];
            if ($record['description'] === '' || trim($record['content']) === '') {
                abort(422, 'La descripción y el contenido no pueden estar vacíos.');
            }
            DB::table('ai_prompts')->insert($record);
            $this->recordChange($record, 'created', $request);
            return $this->findPrompt($record['code']);
        });

        return response()->json(['data' => $prompt], 201);
    }

    public function storeVersion(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'code' => ['prohibited'],
            'description' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string', 'max:100000'],
            'version' => ['required', 'string', 'max:20', 'regex:/^v?[0-9]+(\.[0-9]+)*$/'],
            'expected_version' => ['required', 'integer', 'min:1'],
        ], [
            'code.prohibited' => 'El código no puede modificarse en una nueva versión.',
            'version.required' => 'La nueva versión es obligatoria.',
            'version.regex' => 'El formato de versión no es válido (ejemplo: 2.0).',
        ]);

        if (trim($data['description']) === '' || trim($data['content']) === '') {
            abort(422, 'La descripción y el contenido no pueden estar vacíos.');
        }

        $newVersion = ltrim(trim((string) $data['version']), 'vV');

        $prompt = DB::transaction(function () use ($request, $code, $data, $newVersion) {
            $original = DB::table('ai_prompts')->where('code', $code)->lockForUpdate()->first();
            abort_if($original === null, 404, 'No existe un prompt con ese código.');

            if ($original->archived_at !== null) {
                abort(409, 'No se puede crear una nueva versión de un prompt archivado.');
            }

            if ((int) $original->lock_version !== (int) $data['expected_version']) {
                abort(409, 'Este prompt cambió mientras lo editabas. Actualizá y volvé a intentarlo.');
            }

            $currentVersion = (string) $original->version;
            if (!version_compare($newVersion, $currentVersion, '>')) {
                throw ValidationException::withMessages([
                    'version' => 'La nueva versión (' . $newVersion . ') debe ser estrictamente superior a la versión actual (' . $currentVersion . ').',
                ]);
            }

            $newLockVersion = (int) $original->lock_version + 1;
            $affected = DB::table('ai_prompts')
                ->where('id', $original->id)
                ->where('lock_version', $original->lock_version)
                ->update([
                    'description' => trim($data['description']),
                    'content' => $data['content'],
                    'version' => $newVersion,
                    'lock_version' => $newLockVersion,
                    'updated_at' => now(),
                ]);

            if ($affected !== 1) {
                abort(409, 'Conflicto de actualización. Volvé a cargar los datos.');
            }

            $updated = (array) DB::table('ai_prompts')->where('id', $original->id)->first();
            $this->recordChange($updated, 'new_version', $request);

            return $this->findPrompt($code);
        });

        return response()->json(['data' => $prompt]);
    }

    public function update(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'code' => ['prohibited'],
            'description' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string', 'max:100000'],
            'version' => ['nullable', 'string', 'max:20', 'regex:/^v?[0-9]+(\.[0-9]+)*$/'],
            'expected_version' => ['required', 'integer', 'min:1'],
        ], [
            'code.prohibited' => 'El código no es editable una vez creado.',
            'version.regex' => 'El formato de versión no es válido (ejemplo: 1.0).',
        ]);
        if (trim($data['description']) === '' || trim($data['content']) === '') {
            abort(422, 'La descripción y el contenido no pueden estar vacíos.');
        }

        $submittedVersion = isset($data['version']) && trim((string) $data['version']) !== ''
            ? ltrim(trim((string) $data['version']), 'vV')
            : null;

        return $this->change($request, $code, (int) $data['expected_version'], function ($prompt) use ($data, $submittedVersion) {
            if ($prompt->archived_at !== null) abort(409, 'Restaurá este prompt antes de editarlo.');
            if ($submittedVersion !== null && $submittedVersion !== (string) $prompt->version) {
                throw ValidationException::withMessages([
                    'version' => 'La versión no puede modificarse mediante edición. Usá la acción "Nueva versión".',
                ]);
            }
            return ['description' => trim($data['description']), 'content' => $data['content']];
        }, 'updated');
    }

    /** DELETE archives prompts without losing their history or reusable codes. */
    public function destroy(Request $request, string $code): JsonResponse
    {
        $data = $request->validate(['expected_version' => ['required', 'integer', 'min:1']]);
        return $this->change($request, $code, (int) $data['expected_version'], function ($prompt) {
            if ($prompt->archived_at !== null) abort(409, 'El prompt ya está archivado.');
            return ['archived_at' => now()];
        }, 'archived');
    }

    public function reactivate(Request $request, string $code): JsonResponse
    {
        $data = $request->validate(['expected_version' => ['required', 'integer', 'min:1']]);
        return $this->change($request, $code, (int) $data['expected_version'], function ($prompt) {
            if ($prompt->archived_at === null) abort(409, 'El prompt ya está activo.');
            return ['archived_at' => null];
        }, 'reactivated');
    }

    public function restoreRevision(Request $request, string $code, int $version): JsonResponse
    {
        $data = $request->validate(['expected_version' => ['required', 'integer', 'min:1']]);
        return $this->change($request, $code, (int) $data['expected_version'], function ($prompt) use ($version) {
            if ($prompt->archived_at !== null) abort(409, 'Restaurá este prompt antes de recuperar una versión.');
            $revision = DB::table('ai_prompt_revisions')
                ->where('ai_prompt_id', $prompt->id)->where('version', $version)->first();
            abort_if($revision === null, 404, 'Versión histórica inexistente.');
            $delta = ['description' => $revision->description, 'content' => $revision->content];
            if (isset($revision->prompt_version) && (string) $revision->prompt_version !== '') {
                $delta['version'] = (string) $revision->prompt_version;
            }
            return $delta;
        }, 'restored');
    }

    private function change(Request $request, string $code, int $expectedVersion, callable $changes, string $action): JsonResponse
    {
        $prompt = DB::transaction(function () use ($request, $code, $expectedVersion, $changes, $action) {
            $original = DB::table('ai_prompts')->where('code', $code)->lockForUpdate()->first();
            abort_if($original === null, 404, 'No existe un prompt con ese código.');
            if ((int) $original->lock_version !== $expectedVersion) {
                abort(409, 'Este prompt cambió mientras lo editabas. Actualizá y volvé a intentarlo.');
            }

            $delta = $changes($original);
            $newLockVersion = (int) $original->lock_version + 1;
            $affected = DB::table('ai_prompts')
                ->where('id', $original->id)->where('lock_version', $expectedVersion)
                ->update([...$delta, 'lock_version' => $newLockVersion, 'updated_at' => now()]);
            if ($affected !== 1) abort(409, 'Conflicto de actualización. Volvé a cargar los datos.');
            $updated = (array) DB::table('ai_prompts')->where('id', $original->id)->first();
            $this->recordChange($updated, $action, $request);
            return $this->findPrompt($code);
        });
        return response()->json(['data' => $prompt]);
    }

    private function findPrompt(string $code): object
    {
        $prompt = DB::table('ai_prompts')->where('code', $code)
            ->first(['id', 'code', 'description', 'content', 'version', 'lock_version', 'archived_at', 'updated_at']);
        abort_if($prompt === null, 404, 'No existe un prompt con ese código.');
        return $prompt;
    }

    private function recordChange(array $prompt, string $action, Request $request): void
    {
        $actor = (string) $request->user()->getAuthIdentifier();
        DB::table('ai_prompt_revisions')->insert([
            'id' => (string) Str::ulid(),
            'ai_prompt_id' => $prompt['id'],
            'version' => $prompt['lock_version'],
            'prompt_version' => $prompt['version'],
            'description' => $prompt['description'],
            'content' => $prompt['content'],
            'action' => $action,
            'actor_id' => $actor,
            'created_at' => now(),
        ]);
        DB::table('audit_events')->insert([
            'id' => (string) Str::ulid(),
            'event_type' => 'AI_PROMPT.'.strtoupper($action),
            'action' => $action,
            'entity_type' => 'AiPrompt',
            'entity_id' => $prompt['id'],
            'actor_type' => 'user',
            'actor_id' => $actor,
            'correlation_id' => $request->attributes->get('correlation_id'),
            'metadata' => json_encode(['code' => $prompt['code'], 'version' => $prompt['version'], 'lock_version' => $prompt['lock_version']]),
            'occurred_at' => now(),
        ]);
    }
}
