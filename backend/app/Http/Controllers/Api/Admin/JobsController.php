<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreJobRequest;
use App\Http\Requests\Admin\UpdateJobRequest;
use App\Http\Requests\Admin\UpdateJobStatusRequest;
use App\Services\DemoStateService;
use Illuminate\Http\JsonResponse;

class JobsController extends Controller
{
    public function store(StoreJobRequest $request, DemoStateService $demoStateService): JsonResponse
    {
        return response()->json($demoStateService->createJob($request->validated()), 201);
    }

    public function update(string $jobId, UpdateJobRequest $request, DemoStateService $demoStateService): JsonResponse
    {
        return response()->json($demoStateService->updateJob($jobId, $request->validated()));
    }

    public function destroy(string $jobId, DemoStateService $demoStateService): JsonResponse
    {
        return response()->json($demoStateService->deleteJob($jobId));
    }

    public function updateStatus(string $jobId, UpdateJobStatusRequest $request, DemoStateService $demoStateService): JsonResponse
    {
        $validated = $request->validated();

        return response()->json($demoStateService->updateJobStatus($jobId, $validated['status']));
    }

    public function candidates(string $jobId, DemoStateService $demoStateService): JsonResponse
    {
        return response()->json($demoStateService->jobCandidates($jobId));
    }
}
