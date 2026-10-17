<?php
namespace App\Presentation\Http\Controllers;

use App\Application\Authentication\UseCases\LoginUser;
use App\Infrastructure\Identity\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

final class StorefrontRegistrationController
{
    public function __invoke(Request $request, LoginUser $login): JsonResponse
    {
        if (is_string($request->input('email'))) {
            $request->merge(['email' => mb_strtolower(trim($request->input('email')))]);
        }
        $input = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email', function ($attribute, $value, $fail): void {
                if (User::query()->whereRaw('LOWER(email) = ?', [$value])->exists()) $fail('Este correo ya está registrado.');
            }],
            'password' => ['required', 'string', 'min:8', 'max:128', 'confirmed'],
        ]);
        return DB::transaction(function () use ($input, $request, $login): JsonResponse {
            // Public registration never assigns administrative roles or permissions.
            $user = new User();
            $user->fill(['id' => (string) Str::ulid(), 'name' => $input['name'], 'email' => $input['email'],
                'password' => Hash::make($input['password']), 'active' => true]);
            $user->role = 'customer';
            $user->save();
            $session = $login->handle($input['email'], $input['password'], 'fixphone-store',
                $request->attributes->get('correlation_id'));
            return response()->json(['data' => $session->toArray()], 201)->header('Cache-Control', 'no-store');
        });
    }
}
