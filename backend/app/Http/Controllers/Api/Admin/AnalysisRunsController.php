<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\AnalysisRunService;
use Illuminate\Http\JsonResponse;

class AnalysisRunsController extends Controller
{
    public function show(string $analysisRunId, AnalysisRunService $analysisRunService): JsonResponse
    {
        return response()->json($analysisRunService->details((int) $analysisRunId));
    }

    public function events(string $analysisRunId, AnalysisRunService $analysisRunService): JsonResponse
    {
        return response()->json($analysisRunService->events((int) $analysisRunId));
    }
}
