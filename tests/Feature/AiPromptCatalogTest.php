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

        // Editing with different version is rejected
        $code = (string) $res1->json('data.code');
        $this->patchJson('/api/v1/admin/ai-prompts/'.$code, [
            'description' => 'Intento de cambiar versión mediante PATCH',
            'content' => 'Contenido',
            'version' => '1.1',
            'expected_version' => 1,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['version']);

        // Editing without version or with matching version succeeds and preserves version
        $updated = $this->patchJson('/api/v1/admin/ai-prompts/'.$code, [
            'description' => 'Prompt actualizado',
            'content' => 'Contenido actualizado',
            'expected_version' => 1,
        ])->assertOk();
        $this->assertSame('1.0', $updated->json('data.version'));
        $this->assertSame('Prompt actualizado', $updated->json('data.description'));
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

        // Edit description and content within same version 1.0
        $this->patchJson($url.'/PROMPT-0001', [
            'description' => 'Publicidad de dispositivo FixPhone - ajustado',
            'content' => 'Texto con comillas: "b" y líneas'."\n".'segunda línea',
            'expected_version' => 1,
        ])->assertOk()
            ->assertJsonPath('data.version', '1.0')
            ->assertJsonPath('data.lock_version', 2);

        // Create new version 2.0 via dedicated versions endpoint
        $this->postJson($url.'/PROMPT-0001/versions', [
            'description' => 'Publicidad de dispositivo FixPhone - v2.0',
            'content' => 'Contenido evolucionado v2.0',
            'version' => '2.0',
            'expected_version' => 2,
        ])->assertOk()
            ->assertJsonPath('data.version', '2.0')
            ->assertJsonPath('data.lock_version', 3);

        $this->deleteJson($url.'/PROMPT-0001', ['expected_version' => 3])
            ->assertOk()
            ->assertJsonPath('data.lock_version', 4);
        $this->assertNotNull(DB::table('ai_prompts')->where('id', $id)->value('archived_at'));

        $this->postJson($url.'/PROMPT-0001/reactivate', ['expected_version' => 4])
            ->assertOk()
            ->assertJsonPath('data.lock_version', 5)
            ->assertJsonPath('data.archived_at', null);

        $this->getJson($url.'/PROMPT-0001/history')->assertOk()
            ->assertJsonCount(5, 'data')
            ->assertJsonPath('data.0.action', 'reactivated');

        $this->postJson($url.'/PROMPT-0001/revisions/1/restore', ['expected_version' => 5])
            ->assertOk()
            ->assertJsonPath('data.lock_version', 6)
            ->assertJsonPath('data.content', 'Primera versión del prompt publicitario')
            ->assertJsonPath('data.description', 'Publicidad de dispositivo FixPhone');

        $this->assertDatabaseCount('ai_prompts', 1);
        $this->assertDatabaseCount('ai_prompt_revisions', 6);
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

    public function test_versioning_preserves_code_and_id_from_1_0_to_2_0(): void
    {
        $this->signInAs('owner');
        $created = $this->postJson('/api/v1/admin/ai-prompts', [
            'description' => 'Prompt maestro v1.0',
            'content' => 'Instrucciones v1.0',
        ])->assertCreated();

        $originalId = $created->json('data.id');
        $originalCode = $created->json('data.code');

        $versioned = $this->postJson('/api/v1/admin/ai-prompts/'.$originalCode.'/versions', [
            'description' => 'Prompt maestro v2.0',
            'content' => 'Instrucciones v2.0 mejoradas',
            'version' => '2.0',
            'expected_version' => 1,
        ])->assertOk();

        $this->assertSame($originalId, $versioned->json('data.id'));
        $this->assertSame($originalCode, $versioned->json('data.code'));
        $this->assertSame('2.0', $versioned->json('data.version'));
        $this->assertSame(2, $versioned->json('data.lock_version'));
    }

    public function test_versioning_creates_new_revision_and_preserves_previous_snapshot(): void
    {
        $this->signInAs('owner');
        $created = $this->postJson('/api/v1/admin/ai-prompts', [
            'description' => 'Prompt inicial',
            'content' => 'Contenido v1.0 exacto',
            'version' => '1.0',
        ])->assertCreated();

        $code = $created->json('data.code');
        $id = $created->json('data.id');

        $this->postJson('/api/v1/admin/ai-prompts/'.$code.'/versions', [
            'description' => 'Prompt evolucionado',
            'content' => 'Contenido v2.0 nuevo',
            'version' => '2.0',
            'expected_version' => 1,
        ])->assertOk();

        $revisions = DB::table('ai_prompt_revisions')
            ->where('ai_prompt_id', $id)
            ->orderBy('version')
            ->get();

        $this->assertCount(2, $revisions);

        // Previous revision 1.0 intact
        $this->assertSame('1.0', $revisions[0]->prompt_version);
        $this->assertSame('Contenido v1.0 exacto', $revisions[0]->content);
        $this->assertSame('created', $revisions[0]->action);

        // New revision 2.0
        $this->assertSame('2.0', $revisions[1]->prompt_version);
        $this->assertSame('Contenido v2.0 nuevo', $revisions[1]->content);
        $this->assertSame('new_version', $revisions[1]->action);
    }

    public function test_versioning_does_not_create_second_ai_prompts_row(): void
    {
        $this->signInAs('owner');
        $created = $this->postJson('/api/v1/admin/ai-prompts', [
            'description' => 'Único prompt',
            'content' => 'Contenido',
        ])->assertCreated();

        $code = $created->json('data.code');

        $this->postJson('/api/v1/admin/ai-prompts/'.$code.'/versions', [
            'description' => 'Único prompt v2.0',
            'content' => 'Contenido nuevo',
            'version' => '2.0',
            'expected_version' => 1,
        ])->assertOk();

        $this->assertDatabaseCount('ai_prompts', 1);
    }

    public function test_versioning_does_not_increment_ai_prompt_sequences(): void
    {
        $this->signInAs('owner');
        $first = $this->postJson('/api/v1/admin/ai-prompts', [
            'description' => 'Primer prompt',
            'content' => 'Contenido 1',
        ])->assertCreated();

        $code = $first->json('data.code');
        $this->assertSame('PROMPT-0001', $code);

        $seqBefore = DB::table('ai_prompt_sequences')->value('last_number');

        // Create new version of PROMPT-0001
        $this->postJson('/api/v1/admin/ai-prompts/'.$code.'/versions', [
            'description' => 'Primer prompt v2.0',
            'content' => 'Contenido 2.0',
            'version' => '2.0',
            'expected_version' => 1,
        ])->assertOk();

        $seqAfter = DB::table('ai_prompt_sequences')->value('last_number');
        $this->assertSame($seqBefore, $seqAfter, 'ai_prompt_sequences was incremented during versioning');

        // Next new prompt created must still be PROMPT-0002
        $second = $this->postJson('/api/v1/admin/ai-prompts', [
            'description' => 'Segundo prompt familia distinta',
            'content' => 'Contenido 2',
        ])->assertCreated();
        $this->assertSame('PROMPT-0002', $second->json('data.code'));
    }

    public function test_versioning_rejects_same_version(): void
    {
        $this->signInAs('owner');
        $created = $this->postJson('/api/v1/admin/ai-prompts', [
            'description' => 'Prompt',
            'content' => 'Contenido',
            'version' => '1.0',
        ])->assertCreated();

        $code = $created->json('data.code');

        $this->postJson('/api/v1/admin/ai-prompts/'.$code.'/versions', [
            'description' => 'Misma versión',
            'content' => 'Contenido modificado',
            'version' => '1.0',
            'expected_version' => 1,
        ])->assertStatus(422);

        $this->assertDatabaseHas('ai_prompts', [
            'code' => $code,
            'version' => '1.0',
            'lock_version' => 1,
        ]);
    }

    public function test_versioning_rejects_inferior_version(): void
    {
        $this->signInAs('owner');
        $created = $this->postJson('/api/v1/admin/ai-prompts', [
            'description' => 'Prompt v2.0',
            'content' => 'Contenido',
            'version' => '2.0',
        ])->assertCreated();

        $code = $created->json('data.code');

        $this->postJson('/api/v1/admin/ai-prompts/'.$code.'/versions', [
            'description' => 'Versión inferior 1.9',
            'content' => 'Contenido modificado',
            'version' => '1.9',
            'expected_version' => 1,
        ])->assertStatus(422);
    }

    public function test_versioning_uses_segmented_numerical_comparison(): void
    {
        $this->signInAs('owner');
        $created = $this->postJson('/api/v1/admin/ai-prompts', [
            'description' => 'Prompt segmentado',
            'content' => 'Contenido',
            'version' => '1.9',
        ])->assertCreated();

        $code = $created->json('data.code');

        // 1.10 is numerically GREATER than 1.9 (segment 10 > 9)
        $v110 = $this->postJson('/api/v1/admin/ai-prompts/'.$code.'/versions', [
            'description' => 'Prompt v1.10',
            'content' => 'Contenido v1.10',
            'version' => '1.10',
            'expected_version' => 1,
        ])->assertOk();
        $this->assertSame('1.10', $v110->json('data.version'));

        // 1.9 on top of 1.10 must be rejected
        $this->postJson('/api/v1/admin/ai-prompts/'.$code.'/versions', [
            'description' => 'Retroceso a 1.9',
            'content' => 'Contenido retroceso',
            'version' => '1.9',
            'expected_version' => 2,
        ])->assertStatus(422);

        // 2.0 on top of 1.10 must succeed
        $v20 = $this->postJson('/api/v1/admin/ai-prompts/'.$code.'/versions', [
            'description' => 'Prompt v2.0',
            'content' => 'Contenido v2.0',
            'version' => '2.0',
            'expected_version' => 2,
        ])->assertOk();
        $this->assertSame('2.0', $v20->json('data.version'));

        // 1.0.1 on top of 1.0 test
        $createdSub = $this->postJson('/api/v1/admin/ai-prompts', [
            'description' => 'Subversion base',
            'content' => 'Base 1.0',
            'version' => '1.0',
        ])->assertCreated();
        $codeSub = $createdSub->json('data.code');

        $v101 = $this->postJson('/api/v1/admin/ai-prompts/'.$codeSub.'/versions', [
            'description' => 'Subversion 1.0.1',
            'content' => 'Patch 1.0.1',
            'version' => '1.0.1',
            'expected_version' => 1,
        ])->assertOk();
        $this->assertSame('1.0.1', $v101->json('data.version'));
    }

    public function test_versioning_lock_version_conflict_returns_409_without_changes(): void
    {
        $this->signInAs('owner');
        $created = $this->postJson('/api/v1/admin/ai-prompts', [
            'description' => 'Concurrencia',
            'content' => 'Contenido',
            'version' => '1.0',
        ])->assertCreated();

        $code = $created->json('data.code');

        $this->postJson('/api/v1/admin/ai-prompts/'.$code.'/versions', [
            'description' => 'Conflicto',
            'content' => 'Nuevo contenido',
            'version' => '2.0',
            'expected_version' => 99,
        ])->assertStatus(409);

        $this->assertDatabaseHas('ai_prompts', [
            'code' => $code,
            'version' => '1.0',
            'lock_version' => 1,
            'description' => 'Concurrencia',
        ]);
    }

    public function test_versioning_rejects_archived_prompt(): void
    {
        $this->signInAs('owner');
        $created = $this->postJson('/api/v1/admin/ai-prompts', [
            'description' => 'Archivable',
            'content' => 'Contenido',
        ])->assertCreated();

        $code = $created->json('data.code');
        $this->deleteJson('/api/v1/admin/ai-prompts/'.$code, ['expected_version' => 1])->assertOk();

        $this->postJson('/api/v1/admin/ai-prompts/'.$code.'/versions', [
            'description' => 'Intento en archivado',
            'content' => 'Contenido',
            'version' => '2.0',
            'expected_version' => 2,
        ])->assertStatus(409);
    }

    public function test_versioning_rejects_client_provided_code(): void
    {
        $this->signInAs('owner');
        $created = $this->postJson('/api/v1/admin/ai-prompts', [
            'description' => 'Código fijo',
            'content' => 'Contenido',
        ])->assertCreated();

        $code = $created->json('data.code');

        $this->postJson('/api/v1/admin/ai-prompts/'.$code.'/versions', [
            'code' => 'PROMPT-9999',
            'description' => 'Intento de modificar código',
            'content' => 'Contenido',
            'version' => '2.0',
            'expected_version' => 1,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['code']);
    }

    public function test_versioning_preserves_historical_promotional_assets(): void
    {
        $this->signInAs('owner');
        $created = $this->postJson('/api/v1/admin/ai-prompts', [
            'description' => 'PROMPT-0001 Publicidad FixPhone',
            'content' => 'Prompt maestro v1.0 original',
            'version' => '1.0',
        ])->assertCreated();

        $code = $created->json('data.code');

        // Create a mock inventory item and an approved promotional asset generated with PROMPT-0001 v1.0
        $deviceId = (string) Str::ulid();
        DB::table('inventory_items')->insert([
            'id' => $deviceId,
            'sku' => 'FXP-MOCK-001',
            'title' => 'Samsung A22',
            'item_type' => 'used_phone',
            'operational_status' => 'disponible',
            'publication_status' => 'publicado',
            'inventory_purpose' => 'sell_as_used_phone',
            'stock_quantity' => 1,
            'sale_price_amount_minor' => 100000,
            'currency_code' => 'UYU',
            'metadata' => json_encode([]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $profileId = (string) Str::ulid();
        DB::table('media_storage_profiles')->insert([
            'id' => $profileId,
            'name' => 'R2',
            'provider' => 'r2',
            'bucket' => 'images',
            'endpoint_url' => 'https://test.r2.cloudflarestorage.com',
            'public_base_url' => 'https://cdn.fixphone.test',
            'object_prefix' => 'media',
            'access_key_id_encrypted' => \Illuminate\Support\Facades\Crypt::encryptString('access'),
            'secret_access_key_encrypted' => \Illuminate\Support\Facades\Crypt::encryptString('secret'),
            'is_selected' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $photoId = (string) Str::ulid();
        DB::table('inventory_item_photos')->insert([
            'id' => $photoId,
            'inventory_item_id' => $deviceId,
            'media_storage_profile_id' => $profileId,
            'object_key' => 'media/photo.webp',
            'public_url' => 'https://cdn.fixphone.test/real.webp',
            'content_type' => 'image/webp',
            'byte_size' => 1000,
            'status' => 'confirmed',
            'is_primary' => true,
            'sort_order' => 0,
            'upload_expires_at' => now()->addHour(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $assetId = (string) Str::ulid();
        DB::table('inventory_item_promotional_assets')->insert([
            'id' => $assetId,
            'inventory_item_id' => $deviceId,
            'source_photo_id' => $photoId,
            'prompt_code' => $code,
            'prompt_version' => '1.0',
            'prompt_snapshot' => 'Snapshot v1.0 histórico inmutable',
            'status' => 'approved',
            'image_url' => 'https://cdn.fixphone.test/approved-v1.webp',
            'created_at' => now()->subDay(),
            'updated_at' => now()->subDay(),
        ]);

        // Now evolve PROMPT-0001 to v2.0
        $this->postJson('/api/v1/admin/ai-prompts/'.$code.'/versions', [
            'description' => 'PROMPT-0001 Publicidad FixPhone v2.0',
            'content' => 'Prompt maestro v2.0 evolucionado',
            'version' => '2.0',
            'expected_version' => 1,
        ])->assertOk();

        // The existing promotional asset MUST remain strictly on PROMPT-0001 / v1.0
        $asset = DB::table('inventory_item_promotional_assets')->where('id', $assetId)->first();
        $this->assertNotNull($asset);
        $this->assertSame($code, $asset->prompt_code);
        $this->assertSame('1.0', $asset->prompt_version);
        $this->assertSame('Snapshot v1.0 histórico inmutable', $asset->prompt_snapshot);
        $this->assertSame('approved', $asset->status);
    }
}

