<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DemoStateService;
use Illuminate\Http\JsonResponse;

class BootstrapController extends Controller
{
    public function __invoke(DemoStateService $demoStateService): JsonResponse
    {
        return response()->json($demoStateService->bootstrap());
    }
}
