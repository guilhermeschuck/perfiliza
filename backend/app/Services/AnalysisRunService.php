<?php

namespace App\Services;

use App\Models\AnalysisReport;
use App\Models\AnalysisRun;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class AnalysisRunService
{
    /**
     * @param  array<string, mixed>  $attributes
     */
    public function createRun(array $attributes): AnalysisRun
    {
        return AnalysisRun::query()->create([
            'application_id' => (string) ($attributes['application_id'] ?? ''),
            'job_id' => isset($attributes['job_id']) ? (string) $attributes['job_id'] : null,
            'candidate_id' => isset($attributes['candidate_id']) ? (string) $attributes['candidate_id'] : null,
            'status' => (string) ($attributes['status'] ?? 'pending'),
            'reprocess' => (bool) ($attributes['reprocess'] ?? false),
            'trigger_source' => (string) ($attributes['trigger_source'] ?? 'manual'),
            'queue_connection' => isset($attributes['queue_connection']) ? (string) $attributes['queue_connection'] : null,
            'queue_name' => isset($attributes['queue_name']) ? (string) $attributes['queue_name'] : null,
            'model_name' => isset($attributes['model_name']) ? (string) $attributes['model_name'] : null,
            'prompt_version' => isset($attributes['prompt_version']) ? (string) $attributes['prompt_version'] : null,
            'metadata' => is_array($attributes['metadata'] ?? null) ? $attributes['metadata'] : null,
            'started_at' => $this->toCarbon($attributes['started_at'] ?? null),
        ]);
    }

    public function markInProgress(int $analysisRunId): AnalysisRun
    {
        $analysisRun = $this->findOrFail($analysisRunId);
        $analysisRun->status = 'in_progress';
        $analysisRun->started_at = $analysisRun->started_at ?? Carbon::now();
        $analysisRun->error_message = null;
        $analysisRun->save();

        return $analysisRun->fresh() ?? $analysisRun;
    }

    /**
     * @param  array<string, mixed>|null  $reportPayload
     */
    public function markCompleted(
        int $analysisRunId,
        ?array $reportPayload = null,
        ?string $reportMarkdown = null,
        ?string $reportPdfUrl = null,
    ): AnalysisRun
    {
        $analysisRun = $this->findOrFail($analysisRunId);
        $analysisRun->status = 'completed';
        $analysisRun->finished_at = Carbon::now();
        $analysisRun->error_message = null;
        $analysisRun->save();

        if (is_array($reportPayload)) {
            AnalysisReport::query()->create([
                'analysis_run_id' => $analysisRun->id,
                'format' => 'json',
                'report_json' => $reportPayload,
                'report_markdown' => is_string($reportMarkdown) && trim($reportMarkdown) !== ''
                    ? $reportMarkdown
                    : null,
                'report_pdf_url' => is_string($reportPdfUrl) && trim($reportPdfUrl) !== ''
                    ? $reportPdfUrl
                    : null,
                'generated_at' => $this->toCarbon($reportPayload['generatedAt'] ?? null) ?? Carbon::now(),
            ]);
        }

        return $analysisRun->fresh() ?? $analysisRun;
    }

    public function markFailed(int $analysisRunId, string $errorMessage): AnalysisRun
    {
        $analysisRun = $this->findOrFail($analysisRunId);
        $analysisRun->status = 'failed';
        $analysisRun->finished_at = Carbon::now();
        $analysisRun->error_message = $errorMessage;
        $analysisRun->save();

        return $analysisRun->fresh() ?? $analysisRun;
    }

    /**
     * @param  array<string, mixed>  $metadata
     */
    public function mergeMetadata(int $analysisRunId, array $metadata): AnalysisRun
    {
        $analysisRun = $this->findOrFail($analysisRunId);
        $currentMetadata = is_array($analysisRun->metadata) ? $analysisRun->metadata : [];
        $analysisRun->metadata = array_replace_recursive($currentMetadata, $metadata);
        $analysisRun->save();

        return $analysisRun->fresh() ?? $analysisRun;
    }

    public function findOrFail(int $analysisRunId): AnalysisRun
    {
        $analysisRun = AnalysisRun::query()
            ->with([
                'reports' => fn ($query) => $query->latest('id'),
                'score',
                'candidateProfileAi',
                'auditLogs' => fn ($query) => $query->latest('id'),
                'reviewDecisions' => fn ($query) => $query->latest('id'),
            ])
            ->find($analysisRunId);

        if (! $analysisRun) {
            throw ValidationException::withMessages([
                'analysisRunId' => 'A execucao de analise informada nao foi encontrada.',
            ]);
        }

        return $analysisRun;
    }

    /**
     * @return array<string, mixed>
     */
    public function details(int $analysisRunId): array
    {
        $analysisRun = $this->findOrFail($analysisRunId);
        $payload = $this->toPayload($analysisRun);

        return [
            'analysisRun' => $payload,
            'timeline' => $payload['timeline'],
            'reports' => $analysisRun->reports
                ->map(fn (AnalysisReport $report): array => [
                    'id' => $report->id,
                    'format' => $report->format,
                    'generatedAt' => $report->generated_at?->toDateTimeString(),
                    'createdAt' => $report->created_at?->toDateTimeString(),
                    'hasMarkdown' => is_string($report->report_markdown) && trim($report->report_markdown) !== '',
                    'pdfUrl' => $report->report_pdf_url,
                ])
                ->values()
                ->all(),
            'score' => $analysisRun->score
                ? [
                    'overallScore' => $analysisRun->score->overall_score,
                    'compatibilityScore' => $analysisRun->score->compatibility_score,
                    'consistencyScore' => $analysisRun->score->consistency_score,
                    'dimensions' => $analysisRun->score->dimensions_json,
                    'weights' => $analysisRun->score->weights_json,
                    'adjustments' => $analysisRun->score->adjustments_json,
                    'signals' => $analysisRun->score->signals_json,
                    'calculatedAt' => $analysisRun->score->calculated_at?->toDateTimeString(),
                ]
                : null,
            'candidateProfileAi' => $analysisRun->candidateProfileAi
                ? [
                    'candidateId' => $analysisRun->candidateProfileAi->candidate_id,
                    'profileVersion' => $analysisRun->candidateProfileAi->profile_version,
                    'profile' => $analysisRun->candidateProfileAi->profile_json,
                    'confidence' => $analysisRun->candidateProfileAi->confidence_json,
                    'generatedAt' => $analysisRun->candidateProfileAi->generated_at?->toDateTimeString(),
                ]
                : null,
            'auditLogs' => $analysisRun->auditLogs
                ->take(50)
                ->map(fn ($log): array => [
                    'id' => $log->id,
                    'stage' => $log->stage,
                    'level' => $log->level,
                    'eventKey' => $log->event_key,
                    'message' => $log->message,
                    'context' => $log->context_json,
                    'durationMs' => $log->duration_ms,
                    'happenedAt' => $log->happened_at?->toDateTimeString(),
                ])
                ->values()
                ->all(),
            'review' => [
                'latest' => $analysisRun->reviewDecisions->isNotEmpty()
                    ? $this->reviewPayload($analysisRun->reviewDecisions->first())
                    : null,
                'history' => $analysisRun->reviewDecisions
                    ->take(20)
                    ->map(fn ($decision): array => $this->reviewPayload($decision))
                    ->values()
                    ->all(),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function events(int $analysisRunId): array
    {
        $analysisRun = $this->findOrFail($analysisRunId);
        $payload = $this->toPayload($analysisRun);

        return [
            'analysisRunId' => $analysisRun->id,
            'applicationId' => $analysisRun->application_id,
            'status' => $analysisRun->status,
            'startedAt' => $analysisRun->started_at?->toDateTimeString(),
            'finishedAt' => $analysisRun->finished_at?->toDateTimeString(),
            'events' => $payload['timeline'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function toPayload(AnalysisRun $analysisRun): array
    {
        $latestReport = $analysisRun->relationLoaded('reports')
            ? $analysisRun->reports->sortByDesc('id')->first()
            : $analysisRun->reports()->latest('id')->first();

        return [
            'id' => $analysisRun->id,
            'applicationId' => $analysisRun->application_id,
            'jobId' => $analysisRun->job_id,
            'candidateId' => $analysisRun->candidate_id,
            'status' => $analysisRun->status,
            'reprocess' => (bool) $analysisRun->reprocess,
            'triggerSource' => $analysisRun->trigger_source,
            'queueConnection' => $analysisRun->queue_connection,
            'queueName' => $analysisRun->queue_name,
            'modelName' => $analysisRun->model_name,
            'promptVersion' => $analysisRun->prompt_version,
            'startedAt' => $analysisRun->started_at?->toDateTimeString(),
            'finishedAt' => $analysisRun->finished_at?->toDateTimeString(),
            'errorMessage' => $analysisRun->error_message,
            'createdAt' => $analysisRun->created_at?->toDateTimeString(),
            'updatedAt' => $analysisRun->updated_at?->toDateTimeString(),
            'latestReportId' => $latestReport?->id,
            'metadata' => is_array($analysisRun->metadata) ? $analysisRun->metadata : [],
            'timeline' => $this->buildTimeline($analysisRun),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildTimeline(AnalysisRun $analysisRun): array
    {
        $metadata = is_array($analysisRun->metadata) ? $analysisRun->metadata : [];
        $resumeParse = is_array($metadata['pipeline']['resumeParse'] ?? null)
            ? $metadata['pipeline']['resumeParse']
            : [];
        $candidateEnrichment = is_array($metadata['pipeline']['candidateEnrichment'] ?? null)
            ? $metadata['pipeline']['candidateEnrichment']
            : [];
        $skillsAdded = max(0, (int) ($candidateEnrichment['skillsAdded'] ?? 0));
        $experienceUpdated = (bool) ($candidateEnrichment['experienceUpdated'] ?? false);
        $educationUpdated = (bool) ($candidateEnrichment['educationUpdated'] ?? false);

        $timeline = [
            [
                'step' => 'queued',
                'label' => 'Execucao criada',
                'status' => 'completed',
                'at' => $analysisRun->created_at?->toDateTimeString(),
                'details' => 'Solicitacao recebida para processar a analise.',
            ],
            [
                'step' => 'analysis_processing',
                'label' => 'Processamento de analise',
                'status' => $analysisRun->status === 'pending' ? 'pending' : 'completed',
                'at' => $analysisRun->started_at?->toDateTimeString(),
                'details' => $analysisRun->status === 'pending'
                    ? 'Aguardando inicio do processamento.'
                    : 'Pipeline principal de analise iniciada.',
            ],
            [
                'step' => 'resume_parse',
                'label' => 'Parsing do curriculo',
                'status' => (string) ($resumeParse['status'] ?? 'pending'),
                'at' => (string) ($resumeParse['parsedAt'] ?? $analysisRun->started_at?->toDateTimeString()),
                'details' => $resumeParse === []
                    ? 'Sem informacoes de parse para esta execucao.'
                    : ($resumeParse['error'] ?? 'Extracao de sinais do curriculo concluida.'),
            ],
            [
                'step' => 'candidate_enrichment',
                'label' => 'Enriquecimento de perfil',
                'status' => $candidateEnrichment === [] ? 'skipped' : 'completed',
                'at' => $analysisRun->finished_at?->toDateTimeString(),
                'details' => $candidateEnrichment === []
                    ? 'Sem enriquecimento aplicado.'
                    : 'Skills adicionadas: '.$skillsAdded
                        .', experiencia atualizada: '.($experienceUpdated ? 'sim' : 'nao')
                        .', educacao atualizada: '.($educationUpdated ? 'sim' : 'nao').'.',
            ],
            [
                'step' => 'analysis_finalization',
                'label' => 'Finalizacao',
                'status' => $analysisRun->status === 'failed' ? 'failed' : (
                    $analysisRun->status === 'completed' ? 'completed' : $analysisRun->status
                ),
                'at' => $analysisRun->finished_at?->toDateTimeString(),
                'details' => $analysisRun->status === 'failed'
                    ? ($analysisRun->error_message ?? 'Falha durante a finalizacao da analise.')
                    : 'Analise finalizada e relatorio disponivel.',
            ],
        ];

        return collect($timeline)
            ->map(function (array $item): array {
                if (! is_string($item['at'] ?? null) || trim((string) $item['at']) === '') {
                    $item['at'] = null;
                }

                return $item;
            })
            ->values()
            ->all();
    }

    private function toCarbon(mixed $value): ?CarbonInterface
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @param  object  $decision
     * @return array<string, mixed>
     */
    private function reviewPayload(object $decision): array
    {
        return [
            'id' => $decision->id ?? null,
            'analysisRunId' => $decision->analysis_run_id ?? null,
            'reviewerId' => $decision->reviewer_id ?? null,
            'decision' => $decision->decision ?? null,
            'rationale' => $decision->rationale ?? null,
            'tags' => is_array($decision->tags_json ?? null) ? $decision->tags_json : [],
            'decidedAt' => $decision->decided_at?->toDateTimeString(),
            'createdAt' => $decision->created_at?->toDateTimeString(),
        ];
    }
}
