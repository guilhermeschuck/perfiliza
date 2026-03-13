<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreAnalysisReviewDecisionRequest;
use App\Services\AnalysisReviewService;
use Illuminate\Http\JsonResponse;

class AnalysisRunReviewsController extends Controller
{
    public function show(string $analysisRunId, AnalysisReviewService $analysisReviewService): JsonResponse
    {
        return response()->json($analysisReviewService->history((int) $analysisRunId));
    }

    public function store(
        string $analysisRunId,
        StoreAnalysisReviewDecisionRequest $request,
        AnalysisReviewService $analysisReviewService,
    ): JsonResponse {
        return response()->json(
            $analysisReviewService->register((int) $analysisRunId, $request->validated()),
            201
        );
    }
}
