<?php

namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class ReferencePriceCsvImportTest extends TestCase
{
    use RefreshDatabase;

    private const HEADER = 'source,source_country,source_url,observed_date,brand,model,service_code,service_name,currency,price_amount,tax_included,price_type,notes';

    private function signIn(string $role = 'owner'): User
    {
        $user = User::query()->create([
            'id' => (string) Str::ulid(), 'name' => 'Importador',
            'email' => $role.'-'.Str::random(5).'@prices.test',
            'password' => Hash::make('not-used'), 'active' => true,
        ]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => $role]);
        Sanctum::actingAs($user);
        return $user;
    }

    private function csv(array $rows, string $heading = self::HEADER): UploadedFile
    {
        $stream = fopen('php://temp', 'w+');
        fwrite($stream, "\xEF\xBB\xBF".$heading."\r\n");
        foreach ($rows as $row) {
            fputcsv($stream, $row, ',', '"', '');
        }
        rewind($stream);
        $data = stream_get_contents($stream);
        fclose($stream);
        return UploadedFile::fake()->createWithContent('fixphone_tarifas.csv', $data);
    }

    private function row(array $changes = []): array
    {
        return array_values(array_replace([
            'source' => 'APPLE', 'source_country' => 'ES',
            'source_url' => 'https://support.apple.com/es-es/iphone/repair',
            'observed_date' => '2026-10-14', 'brand' => 'Apple',
            'model' => 'iPhone 13', 'service_code' => 'SCREEN',
            'service_name' => 'Cambio de pantalla', 'currency' => 'EUR',
            'price_amount' => '249.00', 'tax_included' => 'unknown',
            'price_type' => 'published_estimate', 'notes' => 'Precio de prueba no real',
        ], $changes));
    }

    private function preview(UploadedFile $file)
    {
        return $this->withHeaders(['Accept' => 'application/json'])
            ->post('/api/v1/admin/reference-prices/imports/preview', ['file' => $file]);
    }

    public function test_rejects_unauthenticated_and_unauthorized_import(): void
    {
        $this->preview($this->csv([$this->row()]))->assertUnauthorized();
        $this->signIn('technician');
        $this->preview($this->csv([$this->row()]))->assertForbidden();
        $this->getJson('/api/v1/admin/reference-prices/imports')->assertForbidden();
    }

    public function test_preview_does_not_write_price_and_confirm_is_idempotent(): void
    {
        $this->signIn();
        $preview = $this->preview($this->csv([$this->row()]))
            ->assertOk()->assertJsonPath('valid', true)
            ->assertJsonPath('summary.total', 1)
            ->assertJsonPath('summary.new', 1);
        $batchId = $preview->json('batch_id');
        $this->assertDatabaseCount('reference_price_observations', 0);

        $url = '/api/v1/admin/reference-prices/imports/'.$batchId.'/confirm';
        $this->postJson($url)->assertOk()
            ->assertJsonPath('data.inserted', 1)->assertJsonPath('data.duplicate', 0)
            ->assertJsonPath('data.already_confirmed', false);
        $this->postJson($url)->assertOk()->assertJsonPath('data.already_confirmed', true);
        $this->assertDatabaseCount('reference_price_observations', 1);
        $this->assertDatabaseHas('reference_price_observations', [
            'model' => 'iPhone 13', 'source_country' => 'ES',
            'currency' => 'EUR', 'price_minor' => 24900, 'minor_digits' => 2,
        ]);
        $this->assertDatabaseHas('audit_events', [
            'event_type' => 'REFERENCE_PRICE_IMPORT.CONFIRMED',
            'entity_type' => 'ReferencePriceImportBatch', 'entity_id' => $batchId,
        ]);
        $this->getJson('/api/v1/admin/reference-prices/imports')
            ->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_reimport_is_duplicate_but_a_new_observation_is_preserved(): void
    {
        $this->signIn();
        $first = $this->preview($this->csv([$this->row()]))->assertOk()->json('batch_id');
        $this->postJson('/api/v1/admin/reference-prices/imports/'.$first.'/confirm')->assertOk();

        $next = $this->preview($this->csv([$this->row()]))->assertOk()
            ->assertJsonPath('summary.duplicate', 1)->assertJsonPath('summary.new', 0)->json('batch_id');
        $this->postJson('/api/v1/admin/reference-prices/imports/'.$next.'/confirm')->assertOk()
            ->assertJsonPath('data.inserted', 0)->assertJsonPath('data.duplicate', 1);

        $later = $this->preview($this->csv([$this->row([
            'observed_date' => '2026-10-15', 'price_amount' => '259.00',
        ])]))->assertOk()->assertJsonPath('summary.new', 1)->json('batch_id');
        $this->postJson('/api/v1/admin/reference-prices/imports/'.$later.'/confirm')->assertOk()
            ->assertJsonPath('data.inserted', 1);
        $this->assertDatabaseCount('reference_price_observations', 2);
        $this->assertDatabaseHas('reference_price_observations', ['price_minor' => 24900, 'observed_date' => '2026-10-14']);
        $this->assertDatabaseHas('reference_price_observations', ['price_minor' => 25900, 'observed_date' => '2026-10-15']);
        $this->assertDatabaseCount('reference_price_import_batches', 3);
    }

    public function test_invalid_rows_cannot_be_confirmed(): void
    {
        $this->signIn();
        $result = $this->preview($this->csv([
            $this->row(['price_amount' => '=1+1']),
            $this->row(['source_url' => 'https://apple.com.evil.test/path']),
            $this->row(['currency' => 'XYZ']),
            $this->row(['observed_date' => '2035-01-01']),
            $this->row(['price_amount' => '250,50']),
        ]))->assertOk()->assertJsonPath('valid', false)
            ->assertJsonPath('summary.errors', 5)
            ->assertJsonPath('batch_id', null);
        $this->assertCount(5, $result->json('errors'));
        $this->assertDatabaseCount('reference_price_import_batches', 0);
        $this->assertDatabaseCount('reference_price_observations', 0);
    }

    public function test_rejects_wrong_columns_and_empty_csv(): void
    {
        $this->signIn();
        $this->preview($this->csv([$this->row()], 'source,model'))
            ->assertUnprocessable();
        $this->preview($this->csv([]))->assertUnprocessable();
        $this->assertDatabaseCount('reference_price_import_batches', 0);
    }

    public function test_quoted_fields_and_duplicate_rows_in_same_file(): void
    {
        $this->signIn();
        $row = $this->row(['notes' => 'IVA desconocido, revisar "cobertura"']);
        $result = $this->preview($this->csv([$row, $row]))
            ->assertOk()->assertJsonPath('valid', true)
            ->assertJsonPath('summary.total', 2)
            ->assertJsonPath('summary.new', 1)
            ->assertJsonPath('summary.duplicate', 1);
        $this->postJson('/api/v1/admin/reference-prices/imports/'.$result->json('batch_id').'/confirm')
            ->assertOk()->assertJsonPath('data.duplicate', 1);
        $this->assertDatabaseHas('reference_price_observations', [
            'notes' => 'IVA desconocido, revisar "cobertura"',
        ]);
    }

    public function test_preview_conflicts_are_detected_within_same_csv(): void
    {
        $this->signIn();
        $this->preview($this->csv([
            $this->row(), $this->row(['price_amount' => '275.00']),
        ]))->assertOk()->assertJsonPath('valid', false)
            ->assertJsonPath('summary.errors', 1);
        $this->assertDatabaseCount('reference_price_import_batches', 0);
    }

    public function test_preview_belongs_to_original_admin_and_expires(): void
    {
        $this->signIn();
        $batch = $this->preview($this->csv([$this->row()]))->assertOk()->json('batch_id');
        $other = $this->signIn('administrator');
        $this->postJson('/api/v1/admin/reference-prices/imports/'.$batch.'/confirm')->assertNotFound();
        DB::table('reference_price_import_batches')->where('id', $batch)->update(['created_by' => $other->id, 'expires_at' => now()->subMinute()]);
        $this->postJson('/api/v1/admin/reference-prices/imports/'.$batch.'/confirm')->assertStatus(409);
        $this->assertDatabaseCount('reference_price_observations', 0);
    }

    public function test_source_market_and_money_precision_are_kept_separate(): void
    {
        $this->signIn();
        $world = $this->row([
            'source' => 'MUNDOMAC', 'source_country' => 'UY',
            'source_url' => 'https://soporte.mundomac.com/iPhone/',
            'currency' => 'UYU', 'price_amount' => '12000.50',
        ]);
        $result = $this->preview($this->csv([$this->row(), $world]))->assertOk()
            ->assertJsonPath('summary.new', 2);
        $this->postJson('/api/v1/admin/reference-prices/imports/'.$result->json('batch_id').'/confirm')
            ->assertOk()->assertJsonPath('data.inserted', 2);
        $this->assertDatabaseHas('reference_price_observations', ['source' => 'APPLE', 'currency' => 'EUR', 'price_minor' => 24900]);
        $this->assertDatabaseHas('reference_price_observations', ['source' => 'MUNDOMAC', 'currency' => 'UYU', 'price_minor' => 1200050]);
    }
}
