<?php

namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class StorefrontCampaignTest extends TestCase
{
    use RefreshDatabase;

    private function signIn(string $role): void
    {
        $user = User::query()->create(['id' => (string) Str::ulid(), 'name' => 'Campaign Test',
            'email' => $role.'-campaign@example.test', 'password' => Hash::make('test-password'), 'active' => true]);
        DB::table('user_roles')->insert(['user_id' => $user->id, 'role_slug' => $role]);
        Sanctum::actingAs($user);
    }
    private function slide(string $id = 'phones'): array
    {
        return ['id' => $id, 'eyebrow' => 'Celulares', 'title' => 'Tu próximo celular está acá',
            'description' => 'Seleccionados y testeados.', 'actionLabel' => 'Ver celulares',
            'actionHref' => '/store/used-phones',
            'image' => ['src' => 'https://pub-example.r2.dev/campaign.webp', 'alt' => 'Celulares', 'objectPosition' => 'center']];
    }

    public function test_public_read_and_management_permissions(): void
    {
        $this->getJson('/api/v1/store/campaigns')->assertOk()->assertJsonPath('data', null);
        $this->getJson('/api/v1/admin/store/campaigns')->assertUnauthorized();
        $this->putJson('/api/v1/admin/store/campaigns', ['slides' => [$this->slide()]])->assertUnauthorized();
        $this->signIn('sales_operator');
        $this->getJson('/api/v1/admin/store/campaigns')->assertForbidden();
        $this->putJson('/api/v1/admin/store/campaigns', ['slides' => [$this->slide()]])->assertForbidden();
    }

    public function test_campaigns_persist_in_order_and_empty_array_hides_the_carousel(): void
    {
        $this->signIn('owner');
        $slides = [$this->slide('second'), $this->slide('first')];
        $this->putJson('/api/v1/admin/store/campaigns', ['slides' => $slides])->assertOk()
            ->assertJsonPath('data.slides.0.id', 'second')->assertJsonPath('data.slides.1.id', 'first')
            ->assertJsonPath('data.slides.0.title', 'Tu próximo celular está acá');
        $this->getJson('/api/v1/store/campaigns')->assertOk()->assertJsonCount(2, 'data.slides');
        $this->assertDatabaseCount('storefront_campaigns', 1);
        $this->putJson('/api/v1/admin/store/campaigns', ['slides' => []])->assertOk()->assertJsonPath('data.slides', []);
        $this->assertDatabaseCount('storefront_campaigns', 1);
    }

    public function test_unsafe_urls_invalid_payloads_and_duplicates_do_not_replace_saved_campaigns(): void
    {
        $this->signIn('owner');
        $this->putJson('/api/v1/admin/store/campaigns', ['slides' => [$this->slide()]])->assertOk();
        foreach (['javascript:alert(1)', 'data:image/svg+xml,x', '//evil.test/x', 'http://example.test/x', '/assets/../private'] as $url) {
            $slide = $this->slide(); $slide['image']['src'] = $url;
            $this->putJson('/api/v1/admin/store/campaigns', ['slides' => [$slide]])->assertUnprocessable()->assertJsonValidationErrors('slides.0.image.src');
        }
        foreach (['javascript:alert(1)', '//evil.test', 'https://example.test', '/admin', '/store\\evil.test'] as $url) {
            $slide = $this->slide(); $slide['actionHref'] = $url;
            $this->putJson('/api/v1/admin/store/campaigns', ['slides' => [$slide]])->assertUnprocessable();
        }
        $this->putJson('/api/v1/admin/store/campaigns', ['slides' => [$this->slide(), $this->slide()]])->assertUnprocessable();
        $this->putJson('/api/v1/admin/store/campaigns', ['slides' => array_map(fn ($i) => $this->slide('slide-'.$i), range(1, 9))])->assertUnprocessable();
        $this->putJson('/api/v1/admin/store/campaigns', [])->assertUnprocessable();
        $this->getJson('/api/v1/store/campaigns')->assertJsonCount(1, 'data.slides')->assertJsonPath('data.slides.0.id', 'phones');
    }

    public function test_local_assets_are_valid_and_blank_optional_fields_remain_strings(): void
    {
        $this->signIn('owner');
        $slide = $this->slide(); $slide['image']['src'] = '/assets/store/hero.webp';
        $slide['eyebrow'] = ''; $slide['description'] = '';
        $this->putJson('/api/v1/admin/store/campaigns', ['slides' => [$slide]])->assertOk()
            ->assertJsonPath('data.slides.0.eyebrow', '')->assertJsonPath('data.slides.0.description', '');
    }
}
