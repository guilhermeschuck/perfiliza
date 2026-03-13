<?php

namespace App\Services;

use App\Models\AnalysisReviewDecision;
use Illuminate\Support\Carbon;

class AnalysisReviewService
{
    public function __construct(
        private readonly AnalysisRunService $analysisRunService,
        private readonly AnalysisPipelinePersistenceService $analysisPipelinePersistenceService,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function history(int $analysisRunId): array
    {
        $analysisRun = $this->analysisRunService->findOrFail($analysisRunId);
        $decisions = AnalysisReviewDecision::query()
            ->where('analysis_run_id', $analysisRunId)
            ->latest('id')
            ->get();

        return [
            'analysisRunId' => $analysisRun->id,
            'applicationId' => $analysisRun->application_id,
            'latestDecision' => $this->toPayload($decisions->first()),
            'history' => $decisions->map(fn (AnalysisReviewDecision $decision): array => $this->toPayload($decision))
                ->values()
                ->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function register(int $analysisRunId, array $input): array
    {
        $analysisRun = $this->analysisRunService->findOrFail($analysisRunId);
        $decision = AnalysisReviewDecision::query()->create([
            'analysis_run_id' => $analysisRun->id,
            'application_id' => $analysisRun->application_id,
            'candidate_id' => $analysisRun->candidate_id,
            'job_id' => $analysisRun->job_id,
            'reviewer_id' => (string) ($input['reviewerId'] ?? ''),
            'decision' => (string) ($input['decision'] ?? 'needs_review'),
            'rationale' => (string) ($input['rationale'] ?? ''),
            'tags_json' => is_array($input['tags'] ?? null)
                ? collect($input['tags'])->map(fn ($tag): string => trim((string) $tag))->filter()->values()->all()
                : null,
            'decided_at' => Carbon::now(),
        ]);

        $this->analysisPipelinePersistenceService->logEvent([
            'analysisRunId' => $analysisRun->id,
            'applicationId' => $analysisRun->application_id,
            'candidateId' => $analysisRun->candidate_id,
            'jobId' => $analysisRun->job_id,
            'stage' => 'manual_review',
            'eventKey' => 'analysis.manual_review.recorded',
            'message' => 'Decisao de revisao manual registrada.',
            'context' => [
                'reviewerId' => $decision->reviewer_id,
                'decision' => $decision->decision,
                'tags' => $decision->tags_json,
            ],
            'lgpdPurpose' => 'recrutamento_e_selecao',
            'lgpdLegalBasis' => 'execucao_de_procedimentos_pre_contratuais',
        ]);

        return [
            'decision' => $this->toPayload($decision),
            ...$this->history($analysisRunId),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function toPayload(?AnalysisReviewDecision $decision): ?array
    {
        if (! $decision) {
            return null;
        }

        return [
            'id' => $decision->id,
            'analysisRunId' => $decision->analysis_run_id,
            'applicationId' => $decision->application_id,
            'candidateId' => $decision->candidate_id,
            'jobId' => $decision->job_id,
            'reviewerId' => $decision->reviewer_id,
            'decision' => $decision->decision,
            'rationale' => $decision->rationale,
            'tags' => is_array($decision->tags_json) ? $decision->tags_json : [],
            'decidedAt' => $decision->decided_at?->toDateTimeString(),
            'createdAt' => $decision->created_at?->toDateTimeString(),
        ];
    }
}
