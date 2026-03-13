<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\UpdateSettingsRequest;
use App\Services\DemoStateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SettingsController extends Controller
{
    public function show(Request $request, DemoStateService $demoStateService): JsonResponse
    {
        $validated = $request->validate([
            'role' => ['required', Rule::in(['admin', 'empresa', 'candidato'])],
            'userId' => ['required', 'string'],
        ]);

        return response()->json($demoStateService->userSettings($validated['role'], $validated['userId']));
    }

    public function update(UpdateSettingsRequest $request, DemoStateService $demoStateService): JsonResponse
    {
        $validated = $request->validated();

        return response()->json(
            $demoStateService->saveUserSettings($validated['role'], $validated['userId'], $validated['settings']),
        );
    }
}
