<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Submissions\StoreSubmissionRequest;
use App\Services\DemoStateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class SubmissionsController extends Controller
{
    public function store(StoreSubmissionRequest $request, DemoStateService $demoStateService): JsonResponse
    {
        $validated = $request->validated();
        $resumeFile = $request->file('resumeFile');

        if ($resumeFile !== null) {
            $path = $resumeFile->store('resumes', 'public');
            $validated['resumeFileName'] = $resumeFile->getClientOriginalName();
            $validated['resumeUrl'] = Storage::disk('public')->url($path);
        }

        unset($validated['resumeFile']);

        return response()->json($demoStateService->createSubmission($validated), 201);
    }
}
