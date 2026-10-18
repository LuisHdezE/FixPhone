<?php

namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use Database\Seeders\AiPromptCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class AiPromptCatalogTest extends TestCase
{
    use RefreshDatabase;

    private function signInAs(string $role): void
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(),
            'name' => 'Operador',
            'email' => $role.'@ai-prompts.test',
            'password' => Hash::make('test-password'),
            'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => $role]);
        Sanctum::actingAs($user);
    }

    public function test_only_authorized_administrators_can_read_prompts(): void
    {
        $this->getJson('/api/v1/admin/ai-prompts')->assertUnauthorized();
        $this->getJson('/api/v1/admin/ai-prompts/PRICE_REF_001')->assertUnauthorized();

        $this->signInAs('technician');
        $this->getJson('/api/v1/admin/ai-prompts')->assertForbidden();
        $this->getJson('/api/v1/admin/ai-prompts/PRICE_REF_001')->assertForbidden();
    }

    public function test_seeded_prompt_is_readable_and_complete(): void
    {
        (new AiPromptCatalogSeeder())->run();
        $this->signInAs('administrator');

        $this->getJson('/api/v1/admin/ai-prompts')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.code', 'PRICE_REF_001')
            ->assertJsonPath('data.0.version', '1.0')
            ->assertJsonMissingPath('data.0.content');

        $response = $this->getJson('/api/v1/admin/ai-prompts/PRICE_REF_001')
            ->assertOk()
            ->assertJsonPath('data.code', 'PRICE_REF_001')
            ->assertJsonPath('data.version', '1.0');

        $content = (string) $response->json('data.content');
        $this->assertStringContainsString('support.apple.com/es-es/iphone/repair', $content);
        $this->assertStringContainsString('soporte.mundomac.com/iPhone', $content);
        $this->assertStringContainsString('source,source_country,source_url,observed_date,brand,model,service_code,service_name,currency,price_amount,tax_included,price_type,notes', $content);
        $this->assertStringContainsString('archivo CSV real descargable', $content);
    }

    public function test_seeder_is_idempotent_and_does_not_overwrite_future_edits(): void
    {
        $seeder = new AiPromptCatalogSeeder();
        $seeder->run();

        DB::table('ai_prompts')->where('code', 'PRICE_REF_001')
            ->update(['content' => 'Contenido ajustado por el administrador']);

        $seeder->run();

        $this->assertDatabaseCount('ai_prompts', 1);
        $this->assertDatabaseHas('ai_prompts', [
            'code' => 'PRICE_REF_001',
            'content' => 'Contenido ajustado por el administrador',
        ]);
    }

    public function test_missing_prompt_returns_404(): void
    {
        $this->signInAs('owner');
        $this->getJson('/api/v1/admin/ai-prompts/NOT_FOUND')->assertNotFound();
    }

    public function test_only_administrators_can_mutate_catalog(): void
    {
        $payload = ['description' => 'Proceso de ejemplo', 'content' => 'Instrucciones reales'];
        $this->postJson('/api/v1/admin/ai-prompts', $payload)->assertUnauthorized();
        $this->signInAs('technician');
        $this->postJson('/api/v1/admin/ai-prompts', $payload)->assertForbidden();
        $this->patchJson('/api/v1/admin/ai-prompts/DEMO_001', [
            'description' => 'Cambio', 'content' => 'Contenido', 'expected_version' => 1,
        ])->assertForbidden();
        $this->deleteJson('/api/v1/admin/ai-prompts/DEMO_001', ['expected_version' => 1])->assertForbidden();
        $this->assertDatabaseCount('ai_prompts', 0);
    }

    public function test_client_cannot_provide_custom_code_on_creation(): void
    {
        $this->signInAs('administrator');
        $this->postJson('/api/v1/admin/ai-prompts', [
            'code' => 'CUSTOM_001',
            'description' => 'Intento con código personalizado',
            'content' => 'Contenido',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['code']);
    }

    public function test_code_is_immutable_on_update(): void
    {
        $this->signInAs('administrator');
        $created = $this->postJson('/api/v1/admin/ai-prompts', [
            'description' => 'Prompt original',
            'content' => 'Contenido inicial',
        ])->assertCreated();

        $code = (string) $created->json('data.code');

        $this->patchJson('/api/v1/admin/ai-prompts/'.$code, [
            'code' => 'PROMPT-9999',
            'description' => 'Intento de modificar código',
            'content' => 'Contenido modificado',
            'expected_version' => 1,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['code']);
    }

    public function test_automatic_code_generation_sequential_format_and_uniqueness(): void
    {
        $this->signInAs('owner');

        $first = $this->postJson('/api/v1/admin/ai-prompts', [
            'description' => 'Primer prompt',
            'content' => 'Contenido 1',
        ])->assertCreated();
        $this->assertSame('PROMPT-0001', $first->json('data.code'));
        $this->assertSame('1.0', $first->json('data.version'));

        $second = $this->postJson('/api/v1/admin/ai-prompts', [
            'description' => 'Segundo prompt',
            'content' => 'Contenido 2',
        ])->assertCreated();
        $this->assertSame('PROMPT-0002', $second->json('data.code'));

        // Archive the first prompt
        $this->deleteJson('/api/v1/admin/ai-prompts/PROMPT-0001', ['expected_version' => 1])
            ->assertOk();

        // Create third prompt: code must increment to PROMPT-0003, never reusing PROMPT-0001
        $third = $this->postJson('/api/v1/admin/ai-prompts', [
            'description' => 'Tercer prompt',
            'content' => 'Contenido 3',
        ])->assertCreated();
        $this->assertSame('PROMPT-0003', $third->json('data.code'));
    }

    public function test_version_defaults_to_1_0_and_accepts_valid_explicit_version(): void
    {
        $this->signInAs('administrator');

        // Without version: defaults to '1.0'
        $res1 = $this->postJson('/api/v1/admin/ai-prompts', [
            'description' => 'Prompt por defecto',
            'content' => 'Contenido',
        ])->assertCreated();
        $this->assertSame('1.0', $res1->json('data.version'));

        // With explicit version
        $res2 = $this->postJson('/api/v1/admin/ai-prompts', [
            'description' => 'Prompt con versión 2.5',
            'content' => 'Contenido',
            'version' => '2.5',
        ])->assertCreated();
        $this->assertSame('2.5', $res2->json('data.version'));

        // With prefix 'v'
        $res3 = $this->postJson('/api/v1/admin/ai-prompts', [
            'description' => 'Prompt con v3.0',
            'content' => 'Contenido',
            'version' => 'v3.0',
        ])->assertCreated();
        $this->assertSame('3.0', $res3->json('data.version'));

        // Invalid version format
        $this->postJson('/api/v1/admin/ai-prompts', [
            'description' => 'Prompt inválido',
            'content' => 'Contenido',
            'version' => 'version-dos',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['version']);

        // Update version
        $code = (string) $res1->json('data.code');
        $updated = $this->patchJson('/api/v1/admin/ai-prompts/'.$code, [
            'description' => 'Prompt actualizado',
            'content' => 'Contenido',
            'version' => '1.1',
            'expected_version' => 1,
        ])->assertOk();
        $this->assertSame('1.1', $updated->json('data.version'));
    }

    public function test_complete_lifecycle_creates_updates_archives_and_reactivates_without_data_loss(): void
    {
        $this->signInAs('owner');
        $url = '/api/v1/admin/ai-prompts';

        $created = $this->postJson($url, [
            'description' => '  Publicidad de dispositivo FixPhone  ',
            'content' => 'Primera versión del prompt publicitario',
        ])->assertCreated()
            ->assertJsonPath('data.code', 'PROMPT-0001')
            ->assertJsonPath('data.version', '1.0')
            ->assertJsonPath('data.lock_version', 1)
            ->assertJsonPath('data.description', 'Publicidad de dispositivo FixPhone');
        $id = $created->json('data.id');

        $this->getJson($url)->assertOk()
            ->assertJsonPath('can_manage', true)
            ->assertJsonPath('data.0.code', 'PROMPT-0001')
            ->assertJsonPath('data.0.version', '1.0');

        $this->patchJson($url.'/PROMPT-0001', [
            'description' => 'Publicidad de dispositivo FixPhone - v1.1',
            'content' => 'Texto con comillas: "b" y líneas'."\n".'segunda línea',
            'version' => '1.1',
            'expected_version' => 1,
        ])->assertOk()
            ->assertJsonPath('data.version', '1.1')
            ->assertJsonPath('data.lock_version', 2);

        $this->deleteJson($url.'/PROMPT-0001', ['expected_version' => 2])
            ->assertOk()
            ->assertJsonPath('data.lock_version', 3);
        $this->assertNotNull(DB::table('ai_prompts')->where('id', $id)->value('archived_at'));

        $this->postJson($url.'/PROMPT-0001/reactivate', ['expected_version' => 3])
            ->assertOk()
            ->assertJsonPath('data.lock_version', 4)
            ->assertJsonPath('data.archived_at', null);

        $this->getJson($url.'/PROMPT-0001/history')->assertOk()
            ->assertJsonCount(4, 'data')
            ->assertJsonPath('data.0.action', 'reactivated');

        $this->postJson($url.'/PROMPT-0001/revisions/1/restore', ['expected_version' => 4])
            ->assertOk()
            ->assertJsonPath('data.lock_version', 5)
            ->assertJsonPath('data.content', 'Primera versión del prompt publicitario')
            ->assertJsonPath('data.description', 'Publicidad de dispositivo FixPhone');

        $this->assertDatabaseCount('ai_prompts', 1);
        $this->assertDatabaseCount('ai_prompt_revisions', 5);
        $this->assertDatabaseHas('audit_events', [
            'entity_type' => 'AiPrompt', 'entity_id' => $id, 'event_type' => 'AI_PROMPT.RESTORED',
        ]);
    }

    public function test_validation_and_conflicts_keep_data_unchanged(): void
    {
        $this->signInAs('administrator');
        $url = '/api/v1/admin/ai-prompts';
        $payload = ['description' => 'Precios', 'content' => 'No perder'];
        $created = $this->postJson($url, $payload)->assertCreated();
        $code = (string) $created->json('data.code');

        $this->patchJson($url.'/'.$code, [
            'code' => 'CHANGED',
            'description' => 'No debe pasar', 'content' => 'contenido', 'expected_version' => 1,
        ])->assertUnprocessable();
        $this->patchJson($url.'/'.$code, [
            'description' => 'Inválido', 'content' => 'cambiado', 'expected_version' => 55,
        ])->assertStatus(409);
        $this->deleteJson($url.'/'.$code, ['expected_version' => 99])->assertStatus(409);
        $this->postJson($url.'/'.$code.'/revisions/9/restore', ['expected_version' => 1])->assertNotFound();
        $this->assertDatabaseHas('ai_prompts', [
            'code' => $code, 'description' => 'Precios', 'content' => 'No perder', 'lock_version' => 1,
        ]);
        $this->assertDatabaseCount('ai_prompt_revisions', 1);
    }
}
