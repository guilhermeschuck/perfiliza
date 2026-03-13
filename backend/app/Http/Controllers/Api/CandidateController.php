<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Candidate\StoreResumeRequest;
use App\Http\Requests\Candidate\UpdateProfileRequest;
use App\Models\Resume;
use App\Services\DemoStateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class CandidateController extends Controller
{
    public function notifications(Request $request, DemoStateService $demoStateService): JsonResponse
    {
        $candidateId = $this->resolveCandidateId($request);

        return response()->json($demoStateService->candidateNotifications($candidateId));
    }

    public function markNotificationRead(
        string $notificationId,
        Request $request,
        DemoStateService $demoStateService,
    ): JsonResponse {
        $candidateId = $this->resolveCandidateId($request);

        return response()->json($demoStateService->markCandidateNotificationRead($candidateId, $notificationId));
    }

    public function profile(Request $request, DemoStateService $demoStateService): JsonResponse
    {
        $candidateId = $this->resolveCandidateId($request);

        return response()->json($demoStateService->candidateProfile($candidateId));
    }

    public function updateProfile(UpdateProfileRequest $request, DemoStateService $demoStateService): JsonResponse
    {
        $validated = $request->validated();
        $candidateId = (string) $validated['candidateId'];
        unset($validated['candidateId']);

        return response()->json($demoStateService->updateCandidateProfile($candidateId, $validated));
    }

    public function resume(Request $request, DemoStateService $demoStateService): JsonResponse
    {
        $candidateId = $this->resolveCandidateId($request);

        return response()->json($demoStateService->candidateResume($candidateId));
    }

    public function storeResume(StoreResumeRequest $request, DemoStateService $demoStateService): JsonResponse
    {
        $validated = $request->validated();
        $candidateId = (string) $validated['candidateId'];
        $resumeFile = $validated['resumeFile'];
        $path = $resumeFile->store('resumes', 'public');
        $resumeFileName = $resumeFile->getClientOriginalName();
        $resumeUrl = Storage::disk('public')->url($path);
        $resumePath = $resumeFile->getRealPath();
        $fileHash = $resumePath ? hash_file('sha256', $resumePath) : null;

        Resume::query()->create([
            'candidate_id' => $candidateId,
            'source' => 'candidate_profile',
            'file_name' => $resumeFileName,
            'file_url' => $resumeUrl,
            'file_hash' => is_string($fileHash) ? $fileHash : null,
            'mime' => $resumeFile->getClientMimeType(),
            'size_bytes' => $resumeFile->getSize(),
            'uploaded_at' => Carbon::now(),
        ]);

        return response()->json($demoStateService->updateCandidateResume($candidateId, $resumeFileName, $resumeUrl), 201);
    }

    public function destroyResume(Request $request, DemoStateService $demoStateService): JsonResponse
    {
        $candidateId = $this->resolveCandidateId($request);

        return response()->json($demoStateService->deleteCandidateResume($candidateId));
    }

    public function savedJobs(Request $request, DemoStateService $demoStateService): JsonResponse
    {
        $candidateId = $this->resolveCandidateId($request);

        return response()->json($demoStateService->candidateSavedJobs($candidateId));
    }

    public function storeSavedJob(Request $request, DemoStateService $demoStateService): JsonResponse
    {
        $validated = $request->validate([
            'candidateId' => ['required', 'string'],
            'jobId' => ['required', 'string'],
        ]);

        return response()->json(
            $demoStateService->saveCandidateJob((string) $validated['candidateId'], (string) $validated['jobId'])
        );
    }

    public function destroySavedJob(string $jobId, Request $request, DemoStateService $demoStateService): JsonResponse
    {
        $candidateId = $this->resolveCandidateId($request);

        return response()->json($demoStateService->removeCandidateSavedJob($candidateId, $jobId));
    }

    public function withdrawApplication(
        string $applicationId,
        Request $request,
        DemoStateService $demoStateService,
    ): JsonResponse {
        $candidateId = $this->resolveCandidateId($request);

        return response()->json($demoStateService->withdrawCandidateApplication($candidateId, $applicationId));
    }

    private function resolveCandidateId(Request $request): string
    {
        $candidateId = trim((string) ($request->input('candidateId', $request->query('candidateId', ''))));

        if ($candidateId === '') {
            throw ValidationException::withMessages([
                'candidateId' => 'candidateId e obrigatorio.',
            ]);
        }

        return $candidateId;
    }
}
