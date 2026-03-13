<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateTokenPricingRequest;
use App\Services\DemoStateService;
use Illuminate\Http\JsonResponse;

class TokenPricingController extends Controller
{
    public function show(DemoStateService $demoStateService): JsonResponse
    {
        return response()->json($demoStateService->tokenPricing());
    }

    public function update(UpdateTokenPricingRequest $request, DemoStateService $demoStateService): JsonResponse
    {
        $validated = $request->validated();

        return response()->json($demoStateService->updateTokenPricing($validated['pricing']));
    }
}
