<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\DemoStateService;
use Illuminate\Http\JsonResponse;

class OverviewController extends Controller
{
    public function companies(DemoStateService $demoStateService): JsonResponse
    {
        $bootstrap = $demoStateService->bootstrap();
        $jobs = collect($bootstrap['jobs'] ?? []);
        $applications = collect($bootstrap['applications'] ?? []);
        $leads = collect($bootstrap['leads'] ?? []);
        $tokenWallets = collect($bootstrap['tokenWallets'] ?? [])->keyBy('companyId');

        $companies = collect($bootstrap['users'] ?? [])
            ->filter(fn (array $user): bool => ($user['role'] ?? null) === 'empresa')
            ->map(function (array $user) use ($applications, $jobs, $leads, $tokenWallets): array {
                $companyJobs = $jobs->where('companyId', $user['id']);
                $wallet = $tokenWallets->get((string) $user['id']);

                return [
                    'id' => (string) $user['id'],
                    'name' => (string) $user['name'],
                    'email' => (string) $user['email'],
                    'company' => (string) ($user['company'] ?? $user['name']),
                    'jobsCount' => $companyJobs->count(),
                    'activeJobsCount' => $companyJobs->where('status', 'active')->count(),
                    'applicationsCount' => $applications->where('companyId', $user['id'])->count(),
                    'leadsCount' => $leads->where('companyId', $user['id'])->count(),
                    'latestJobCreatedAt' => $companyJobs->sortByDesc('createdAt')->value('createdAt'),
                    'tokenBalance' => (int) ($wallet['balance'] ?? 0),
                    'tokensPurchased' => (int) ($wallet['purchased'] ?? 0),
                    'tokensSpent' => (int) ($wallet['spent'] ?? 0),
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'companies' => $companies,
        ]);
    }

    public function candidates(DemoStateService $demoStateService): JsonResponse
    {
        $bootstrap = $demoStateService->bootstrap();
        $applications = collect($bootstrap['applications'] ?? []);

        $candidates = collect($bootstrap['candidates'] ?? [])
            ->map(function (array $candidate) use ($applications): array {
                $candidateApplications = $applications->where('candidateId', $candidate['id'])->values();
                $latestApplication = $candidateApplications->sortByDesc('submittedAt')->first();

                return [
                    ...$candidate,
                    'applicationsCount' => $candidateApplications->count(),
                    'latestApplicationStatus' => $latestApplication['status'] ?? null,
                    'latestApplicationAt' => $latestApplication['submittedAt'] ?? null,
                ];
            })
            ->sortByDesc('createdAt')
            ->values()
            ->all();

        return response()->json([
            'candidates' => $candidates,
        ]);
    }

    public function iaMetrics(DemoStateService $demoStateService): JsonResponse
    {
        $bootstrap = $demoStateService->bootstrap();
        $analyses = collect($bootstrap['analyses'] ?? []);
        $completedAnalyses = $analyses->where('status', 'completed')->values();

        $overallScores = $completedAnalyses
            ->pluck('aiAnalysis.overallScore')
            ->filter(fn ($value): bool => is_numeric($value))
            ->map(fn ($value): float => (float) $value)
            ->values();

        $topSkills = collect($bootstrap['candidates'] ?? [])
            ->flatMap(fn (array $candidate): array => $candidate['skills'] ?? [])
            ->countBy()
            ->sortDesc()
            ->take(8)
            ->map(fn (int $count, string $skill): array => [
                'skill' => $skill,
                'count' => $count,
            ])
            ->values()
            ->all();

        return response()->json([
            'metrics' => [
                'totalAnalyses' => $analyses->count(),
                'completedAnalyses' => $completedAnalyses->count(),
                'pendingAnalyses' => $analyses->where('status', 'pending')->count(),
                'inProgressAnalyses' => $analyses->where('status', 'in_progress')->count(),
                'averageOverallScore' => $overallScores->isEmpty() ? 0 : round($overallScores->avg(), 2),
                'averageCompatibility' => (float) ($bootstrap['dashboardStats']['averageCompatibility'] ?? 0),
                'statusBreakdown' => [
                    'pending' => $analyses->where('status', 'pending')->count(),
                    'in_progress' => $analyses->where('status', 'in_progress')->count(),
                    'completed' => $analyses->where('status', 'completed')->count(),
                ],
                'topSkills' => $topSkills,
            ],
        ]);
    }
}
