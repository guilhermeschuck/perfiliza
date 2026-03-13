<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Jobs\UpdatePublicFormRequest;
use App\Services\DemoStateService;
use Illuminate\Http\JsonResponse;

class JobsController extends Controller
{
    public function updatePublicForm(
        string $jobId,
        UpdatePublicFormRequest $request,
        DemoStateService $demoStateService,
    ): JsonResponse {
        $validated = $request->validated();

        return response()->json($demoStateService->updateJobForm($jobId, $validated['questions']));
    }

    public function submitLead(string $jobId, string $leadId, DemoStateService $demoStateService): JsonResponse
    {
        return response()->json($demoStateService->submitLead($jobId, $leadId), 201);
    }
}
