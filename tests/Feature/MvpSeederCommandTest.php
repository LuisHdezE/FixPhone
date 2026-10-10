<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class MvpSeederCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_aborts_seed_if_not_forced_or_confirmed()
    {
        $this->artisan('fixphone:seed-mvp', ['--seed' => true])
             ->expectsConfirmation('¿Confirmas que deseas insertar datos ficticios MVP en ESTA base de datos?', 'no')
             ->expectsOutput('Operación cancelada.')
             ->assertExitCode(1);
    }

    public function test_it_creates_backup_and_seeds_when_forced()
    {
        // En testing usa sqlite en memoria por defecto o sqlite normal
        $this->artisan('fixphone:seed-mvp', ['--seed' => true, '--force' => true])
             ->expectsOutputToContain('Dataset MVP insertado correctamente')
             ->assertExitCode(0);

        // Verify some data was seeded
        $this->assertDatabaseHas('inventory_items', [
            'item_type' => 'used_phone',
        ]);
        $this->assertDatabaseHas('consignors', []);
    }

    public function test_webhook_aborts_if_config_disabled()
    {
        Config::set('app.mvp_seeder_enabled', false);

        $response = $this->postJson('/api/_deploy/mvp-action', [
            'action' => 'status'
        ]);

        $response->assertStatus(403);
        $response->assertJsonPath('message', 'MVP endpoints are currently disabled.');
    }

    public function test_webhook_requires_different_tokens_for_read_and_write()
    {
        Config::set('app.mvp_seeder_enabled', true);
        putenv('DEPLOY_TOKEN=deploy123');
        putenv('MVP_TOKEN=mvp123');

        // Status is allowed with DEPLOY_TOKEN
        $response = $this->withHeaders([
            'X-Deploy-Token' => 'deploy123'
        ])->postJson('/api/_deploy/mvp-action', [
            'action' => 'status'
        ]);
        $response->assertStatus(200);

        // Seed is NOT allowed with DEPLOY_TOKEN
        $response2 = $this->withHeaders([
            'X-Deploy-Token' => 'deploy123'
        ])->postJson('/api/_deploy/mvp-action', [
            'action' => 'seed'
        ]);
        $response2->assertStatus(401);

        // Seed IS allowed with MVP_TOKEN
        $response3 = $this->withHeaders([
            'X-Deploy-Token' => 'mvp123'
        ])->postJson('/api/_deploy/mvp-action', [
            'action' => 'seed'
        ]);
        $response3->assertStatus(200);
    }
}
