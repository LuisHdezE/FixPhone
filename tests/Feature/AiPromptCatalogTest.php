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

    public function test_missing_prompt_returns_404_and_mutations_are_not_exposed(): void
    {
        $this->signInAs('owner');
        $this->getJson('/api/v1/admin/ai-prompts/NOT_FOUND')->assertNotFound();
        $this->postJson('/api/v1/admin/ai-prompts', [
            'code' => 'EXAMPLE', 'description' => 'No permitido', 'content' => 'test',
        ])->assertStatus(405);
    }
}
