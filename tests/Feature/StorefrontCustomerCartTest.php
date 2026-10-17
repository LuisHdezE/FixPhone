<?php
namespace Tests\Feature;

use App\Infrastructure\Identity\User;
use App\Infrastructure\Inventory\InventoryItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class StorefrontCustomerCartTest extends TestCase
{
    use RefreshDatabase;

    private function customer(): User
    {
        return User::query()->create(['id' => (string) Str::ulid(), 'name' => 'Cliente',
            'email' => Str::ulid().'@example.test', 'password' => Hash::make('secret-password'), 'active' => true]);
    }
    private function product(array $extra = []): InventoryItem
    {
        return InventoryItem::query()->create(array_replace([
            'title' => 'Samsung A22', 'item_type' => 'used_phone', 'operational_status' => 'en_stock',
            'publication_status' => 'publicado', 'inventory_purpose' => 'sell_as_used_phone',
            'is_sellable' => true, 'stock_quantity' => 3, 'sale_price_amount_minor' => 450000, 'currency_code' => 'UYU',
        ], $extra));
    }
    public function test_registration_creates_real_customer_without_admin_permissions_and_login_checks_password(): void
    {
        $registration = $this->postJson('/api/v1/store/register', [
            'name' => 'Luis', 'email' => '  CLIENT@example.test ', 'password' => 'secret-password',
            'password_confirmation' => 'secret-password', 'role' => 'owner', 'permissions' => ['catalog.manage'],
        ])->assertCreated()->assertJsonPath('data.user.permissions', [])->assertJsonPath('data.user.roles', []);
        $user = User::query()->where('email', 'client@example.test')->firstOrFail();
        $this->assertTrue(Hash::check('secret-password', $user->password));
        $this->assertSame('customer', $user->role);
        $this->assertDatabaseMissing('user_roles', ['user_id' => $user->id]);
        $this->postJson('/api/v1/auth/login', ['email' => 'client@example.test', 'password' => 'wrong-password'])->assertUnauthorized();
        $this->postJson('/api/v1/auth/login', ['email' => 'CLIENT@example.test', 'password' => 'secret-password'])->assertOk();
        $this->withToken($registration->json('data.access_token'))->getJson('/api/v1/auth/me')
            ->assertOk()->assertJsonPath('data.email', 'client@example.test');
        $this->getJson('/api/v1/admin/store/campaigns')->assertForbidden();
        $this->postJson('/api/v1/admin/master-data/colors', ['name' => 'Rojo'])->assertForbidden();
        $this->patchJson('/api/v1/admin/master-data/colors/color-black', ['name' => 'Otro'])->assertForbidden();
        $this->deleteJson('/api/v1/admin/master-data/colors/color-black')->assertForbidden();
        $this->putJson('/api/v1/admin/store/campaigns', ['slides' => []])->assertForbidden();
    }
    public function test_registration_rejects_duplicates_weak_and_unconfirmed_passwords(): void
    {
        $user = $this->customer();
        $this->postJson('/api/v1/store/register', ['name' => 'Cliente', 'email' => strtoupper($user->email),
            'password' => 'secret-password', 'password_confirmation' => 'secret-password'])
            ->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->postJson('/api/v1/store/register', ['name' => 'Cliente', 'email' => 'new@example.test',
            'password' => '1234', 'password_confirmation' => '1234'])
            ->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->postJson('/api/v1/store/register', ['name' => 'Cliente', 'email' => 'new@example.test',
            'password' => 'secret-password', 'password_confirmation' => 'different'])
            ->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->assertDatabaseCount('users', 1);
    }
    public function test_guests_can_browse_but_all_cart_endpoints_require_authentication(): void
    {
        $this->get('/')->assertRedirect('/store');
        $item = $this->product();
        $this->getJson('/api/v1/store/products')->assertOk()->assertJsonFragment(['id' => $item->id]);
        $this->getJson('/api/v1/store/campaigns')->assertOk();
        $this->postJson('/api/v1/admin/master-data/colors', ['name' => 'Rojo'])->assertUnauthorized();
        $this->getJson('/api/v1/store/cart')->assertUnauthorized();
        $this->postJson('/api/v1/store/cart', ['product_id' => $item->id, 'quantity' => 1])->assertUnauthorized();
        $this->patchJson('/api/v1/store/cart/'.$item->id, ['quantity' => 2])->assertUnauthorized();
        $this->deleteJson('/api/v1/store/cart/'.$item->id)->assertUnauthorized();
        $this->assertDatabaseCount('storefront_cart_lines', 0);
    }
    public function test_cart_persists_per_user_with_authoritative_price_stock_and_no_inventory_reservation(): void
    {
        $user = $this->customer(); $other = $this->customer();
        $item = $this->product(['main_image_url' => 'https://example.test/samsung-a22.jpg']);
        Sanctum::actingAs($user);
        $this->postJson('/api/v1/store/cart', ['product_id' => $item->id, 'quantity' => 1,
            'unit_price_minor' => 1, 'user_id' => $other->id])
            ->assertOk()->assertJsonPath('data.lines.0.unit_price_minor', 450000)
            ->assertJsonPath('data.lines.0.image_url', 'https://example.test/samsung-a22.jpg');
        $this->postJson('/api/v1/store/cart', ['product_id' => $item->id, 'quantity' => 1])
            ->assertOk()->assertJsonPath('data.lines.0.quantity', 2);
        $this->assertDatabaseCount('storefront_cart_lines', 1);
        $this->postJson('/api/v1/store/cart', ['product_id' => $item->id, 'quantity' => 2])->assertUnprocessable();
        $this->patchJson('/api/v1/store/cart/'.$item->id, ['quantity' => 3])->assertOk();
        $this->assertSame(3, $item->fresh()->stock_quantity);
        Sanctum::actingAs($other);
        $this->getJson('/api/v1/store/cart')->assertOk()->assertJsonPath('data.lines', []);
        $this->patchJson('/api/v1/store/cart/'.$item->id, ['quantity' => 1])->assertNotFound();
        $this->deleteJson('/api/v1/store/cart/'.$item->id)->assertOk();
        Sanctum::actingAs($user);
        $this->getJson('/api/v1/store/cart')->assertJsonPath('data.lines.0.quantity', 3);
        $item->update(['sale_price_amount_minor' => 460000, 'stock_quantity' => 1]);
        $this->getJson('/api/v1/store/cart')->assertJsonPath('data.lines.0.unit_price_minor', 460000)
            ->assertJsonPath('data.lines.0.available', false);
        $this->patchJson('/api/v1/store/cart/'.$item->id, ['quantity' => 1])->assertOk()->assertJsonPath('data.lines.0.available', true);
        $this->deleteJson('/api/v1/store/cart/'.$item->id)->assertOk()->assertJsonPath('data.lines', []);
    }
    public function test_unpublished_sold_deleted_and_nonfunctional_inventory_cannot_be_added(): void
    {
        Sanctum::actingAs($this->customer());
        foreach ([
            ['publication_status' => 'borrador'], ['stock_quantity' => 0], ['sale_price_amount_minor' => 0],
            ['is_sellable' => false], ['operational_status' => 'vendido'],
            ['metadata' => ['origin' => 'recovered', 'part_condition' => 'untested']],
        ] as $changes) {
            $item = $this->product($changes);
            $this->postJson('/api/v1/store/cart', ['product_id' => $item->id, 'quantity' => 1])->assertUnprocessable();
        }
        $item = $this->product(); $item->delete();
        $this->postJson('/api/v1/store/cart', ['product_id' => $item->id, 'quantity' => 1])->assertUnprocessable();
        $this->assertDatabaseCount('storefront_cart_lines', 0);
    }
    public function test_invalid_quantities_and_inactive_accounts_cannot_mutate_cart(): void
    {
        $user = $this->customer(); $item = $this->product(); Sanctum::actingAs($user);
        foreach ([0, -1, 1.5, 1000] as $quantity) {
            $this->postJson('/api/v1/store/cart', ['product_id' => $item->id, 'quantity' => $quantity])->assertUnprocessable();
        }
        $this->postJson('/api/v1/store/cart', ['product_id' => $item->id, 'quantity' => 1])->assertOk();
        $item->update(['publication_status' => 'borrador']);
        $this->getJson('/api/v1/store/cart')->assertJsonPath('data.lines.0.available', false);
        $user->update(['active' => false]);
        $this->getJson('/api/v1/store/cart')->assertForbidden();
        $this->deleteJson('/api/v1/store/cart/'.$item->id)->assertForbidden();
    }
}
