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
            ->assertJsonMissingPath('data.0.content');

        $response = $this->getJson('/api/v1/admin/ai-prompts/PRICE_REF_001')
            ->assertOk()
            ->assertJsonPath('data.code', 'PRICE_REF_001');

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
        $payload = ['code' => 'DEMO_001', 'description' => 'Proceso de ejemplo', 'content' => 'Instrucciones reales'];
        $this->postJson('/api/v1/admin/ai-prompts', $payload)->assertUnauthorized();
        $this->signInAs('technician');
        $this->postJson('/api/v1/admin/ai-prompts', $payload)->assertForbidden();
        $this->patchJson('/api/v1/admin/ai-prompts/DEMO_001', [
            'description' => 'Cambio', 'content' => 'Contenido', 'expected_version' => 1,
        ])->assertForbidden();
        $this->deleteJson('/api/v1/admin/ai-prompts/DEMO_001', ['expected_version' => 1])->assertForbidden();
        $this->assertDatabaseCount('ai_prompts', 0);
    }

    public function test_complete_lifecycle_creates_updates_archives_and_reactivates_without_data_loss(): void
    {
        $this->signInAs('owner');
        $url = '/api/v1/admin/ai-prompts';

        $created = $this->postJson($url, [
            'code' => ' demo_001 ', 'description' => '  Mi operación  ', 'content' => 'Primera versión',
        ])->assertCreated()
            ->assertJsonPath('data.code', 'DEMO_001')
            ->assertJsonPath('data.version', 1)
            ->assertJsonPath('data.description', 'Mi operación');
        $id = $created->json('data.id');

        $this->getJson($url)->assertOk()
            ->assertJsonPath('can_manage', true)
            ->assertJsonPath('data.0.version', 1);

        $this->patchJson($url.'/DEMO_001', [
            'description' => 'Nueva descripción',
            'content' => 'Texto con comillas: "b" y líneas'."\n".'segunda línea',
            'expected_version' => 1,
        ])->assertOk()->assertJsonPath('data.version', 2);

        $this->deleteJson($url.'/DEMO_001', ['expected_version' => 2])
            ->assertOk()->assertJsonPath('data.version', 3);
        $this->assertNotNull(DB::table('ai_prompts')->where('id', $id)->value('archived_at'));

        $this->postJson($url.'/DEMO_001/reactivate', ['expected_version' => 3])
            ->assertOk()->assertJsonPath('data.version', 4)
            ->assertJsonPath('data.archived_at', null);

        $this->getJson($url.'/DEMO_001/history')->assertOk()
            ->assertJsonCount(4, 'data')
            ->assertJsonPath('data.0.action', 'reactivated');

        $this->postJson($url.'/DEMO_001/revisions/1/restore', ['expected_version' => 4])
            ->assertOk()->assertJsonPath('data.version', 5)
            ->assertJsonPath('data.content', 'Primera versión')
            ->assertJsonPath('data.description', 'Mi operación');

        $this->assertDatabaseCount('ai_prompts', 1);
        $this->assertDatabaseCount('ai_prompt_revisions', 5);
        $this->assertDatabaseHas('audit_events', [
            'entity_type' => 'AiPrompt', 'entity_id' => $id, 'event_type' => 'AI_PROMPT.RESTORED',
        ]);
    }

    public function test_validation_duplicates_and_conflicts_keep_data_unchanged(): void
    {
        $this->signInAs('administrator');
        $url = '/api/v1/admin/ai-prompts';
        $payload = ['code' => 'PRICE_REF_001', 'description' => 'Precios', 'content' => 'No perder'];
        $this->postJson($url, $payload)->assertCreated();

        $this->postJson($url, $payload)->assertUnprocessable();
        $this->postJson($url, [...$payload, 'code' => 'a'])->assertUnprocessable();
        $this->postJson($url, [...$payload, 'code' => 'INJECT;DROP'])->assertUnprocessable();
        $this->patchJson($url.'/PRICE_REF_001', [
            'code' => 'CHANGED',
            'description' => 'No debe pasar', 'content' => 'contenido', 'expected_version' => 1,
        ])->assertUnprocessable();
        $this->patchJson($url.'/PRICE_REF_001', [
            'description' => 'Inválido', 'content' => 'cambiado', 'expected_version' => 55,
        ])->assertStatus(409);
        $this->deleteJson($url.'/PRICE_REF_001', ['expected_version' => 99])->assertStatus(409);
        $this->postJson($url.'/PRICE_REF_001/revisions/9/restore', ['expected_version' => 1])->assertNotFound();
        $this->assertDatabaseHas('ai_prompts', [
            'code' => 'PRICE_REF_001', 'description' => 'Precios', 'content' => 'No perder', 'version' => 1,
        ]);
        $this->assertDatabaseCount('ai_prompt_revisions', 1);
    }

    public function test_seeded_reference_prompt_has_first_revision_and_is_not_overwritten(): void
    {
        $seeder = new AiPromptCatalogSeeder();
        $seeder->run();
        $this->assertDatabaseHas('ai_prompt_revisions', ['version' => 1, 'action' => 'seeded']);
        $this->signInAs('owner');
        $this->patchJson('/api/v1/admin/ai-prompts/PRICE_REF_001', [
            'description' => 'Modificado', 'content' => 'Contenido actualizado a mano', 'expected_version' => 1,
        ])->assertOk();
        $seeder->run();
        $this->assertDatabaseHas('ai_prompts', [
            'code' => 'PRICE_REF_001', 'content' => 'Contenido actualizado a mano', 'version' => 2,
        ]);
        $this->assertDatabaseCount('ai_prompt_revisions', 2);
    }
}
