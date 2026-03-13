<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DemoStateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CompanyReportsController extends Controller
{
    public function overview(Request $request, DemoStateService $demoStateService): JsonResponse
    {
        $bootstrap = $demoStateService->bootstrap();
        $companyId = $this->resolveCompanyId($request);

        $jobs = collect($bootstrap['jobs'] ?? [])->where('companyId', $companyId)->values();
        $applications = collect($bootstrap['applications'] ?? [])->where('companyId', $companyId)->values();
        $leads = collect($bootstrap['leads'] ?? [])->where('companyId', $companyId)->values();
        $wallet = collect($bootstrap['tokenWallets'] ?? [])->firstWhere('companyId', $companyId);
        $pricing = is_array($bootstrap['tokenPricing'] ?? null) ? $bootstrap['tokenPricing'] : [];
        $completedStatuses = ['analyzed', 'reviewed', 'approved'];

        $compatibilityScores = $applications
            ->pluck('analysis.compatibilityScore')
            ->filter(fn ($score): bool => is_numeric($score))
            ->map(fn ($score): float => (float) $score)
            ->values();

        $averageCompatibility = $compatibilityScores->isEmpty()
            ? 0
            : round($compatibilityScores->avg(), 2);

        return response()->json([
            'overview' => [
                'companyId' => $companyId,
                'jobsTotal' => $jobs->count(),
                'jobsActive' => $jobs->where('status', 'active')->count(),
                'jobsPaused' => $jobs->where('status', 'paused')->count(),
                'applicationsTotal' => $applications->count(),
                'analysesCompleted' => $applications
                    ->filter(fn (array $application): bool => in_array($application['status'] ?? '', $completedStatuses, true))
                    ->count(),
                'averageCompatibility' => $averageCompatibility,
                'leadsTotal' => $leads->count(),
                'leadsPending' => $leads->where('status', 'new')->count(),
                'leadsSubmitted' => $leads->where('status', 'submitted')->count(),
                'tokenBalance' => (int) ($wallet['balance'] ?? 0),
                'tokensPurchased' => (int) ($wallet['purchased'] ?? 0),
                'tokensSpent' => (int) ($wallet['spent'] ?? 0),
                'campaignTokenCost' => (int) ($pricing['campaign_create'] ?? 0),
                'analysisTokenCost' => (int) ($pricing['resume_analysis_start'] ?? 0),
            ],
        ]);
    }

    public function funnel(Request $request, DemoStateService $demoStateService): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);

        return response()->json($demoStateService->companyReportFunnel($companyId));
    }

    public function sources(Request $request, DemoStateService $demoStateService): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);

        return response()->json($demoStateService->companyReportSources($companyId));
    }

    public function hiringTime(Request $request, DemoStateService $demoStateService): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);

        return response()->json($demoStateService->companyReportHiringTime($companyId));
    }

    private function resolveCompanyId(Request $request): string
    {
        $companyId = trim((string) $request->query('companyId', ''));

        if ($companyId === '') {
            throw ValidationException::withMessages([
                'companyId' => 'companyId e obrigatorio.',
            ]);
        }

        return $companyId;
    }
}
