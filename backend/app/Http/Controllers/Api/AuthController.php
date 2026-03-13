<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use App\Services\DemoStateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(LoginRequest $request, DemoStateService $demoStateService): JsonResponse
    {
        $validated = $request->validated();
        $email = strtolower((string) $validated['email']);
        $role = (string) $validated['role'];
        $password = (string) $validated['password'];

        $user = User::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->first();

        if (! $user || ! Hash::check($password, (string) $user->password) || (string) $user->role !== $role) {
            throw ValidationException::withMessages([
                'email' => 'Credenciais invalidas para o perfil informado.',
            ]);
        }

        $demoStateService->synchronizeUserFromAccount($user);

        return response()->json([
            'user' => [
                'id' => (string) $user->id,
                'name' => (string) $user->name,
                'email' => (string) $user->email,
                'role' => (string) $user->role,
                'company' => $user->company ? (string) $user->company : null,
            ],
        ]);
    }
}
