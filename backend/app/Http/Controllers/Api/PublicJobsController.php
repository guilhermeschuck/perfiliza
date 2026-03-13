<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PublicJobs\StoreLeadRequest;
use App\Services\DemoStateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class PublicJobsController extends Controller
{
    public function show(string $shareToken, DemoStateService $demoStateService): JsonResponse
    {
        $job = $demoStateService->publicJob($shareToken);

        if (! $job) {
            throw ValidationException::withMessages([
                'shareToken' => 'A vaga compartilhada nao foi encontrada.',
            ]);
        }

        return response()->json([
            'job' => $job,
        ]);
    }

    public function storeLead(string $shareToken, StoreLeadRequest $request, DemoStateService $demoStateService): JsonResponse
    {
        $validated = $request->validated();

        if ($validated['resumeFile'] ?? null) {
            $resumeFile = $validated['resumeFile'];
            $path = $resumeFile->store('resumes', 'public');
            $validated['resumeFileName'] = $resumeFile->getClientOriginalName();
            $validated['resumeUrl'] = Storage::disk('public')->url($path);
        }

        unset($validated['resumeFile']);

        return response()->json($demoStateService->createLead($shareToken, $validated), 201);
    }
}
