<?php

namespace App\Jobs;

use App\Services\AnalysisPipelinePersistenceService;
use App\Services\AnalysisReportDocumentService;
use App\Services\AnalysisRunService;
use App\Services\DemoStateService;
use App\Services\ResumeParseService;
use App\Services\StructuredAiAnalysisService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class ProcessApplicationAnalysisJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public int $analysisRunId,
        public string $applicationId,
        public bool $reprocess = false,
    ) {
    }

    public function handle(
        DemoStateService $demoStateService,
        AnalysisRunService $analysisRunService,
        ResumeParseService $resumeParseService,
        StructuredAiAnalysisService $structuredAiAnalysisService,
        AnalysisPipelinePersistenceService $analysisPipelinePersistenceService,
        AnalysisReportDocumentService $analysisReportDocumentService,
    ): void
    {
        $pipelineStartedAt = microtime(true);
        $analysisRunService->markInProgress($this->analysisRunId);
        $parseSummary = null;

        try {
            $analysisPipelinePersistenceService->logEvent([
                'analysisRunId' => $this->analysisRunId,
                'applicationId' => $this->applicationId,
                'stage' => 'pipeline_start',
                'eventKey' => 'analysis.pipeline.started',
                'message' => 'Pipeline de analise iniciado.',
            ]);

            $parseSummary = $resumeParseService->parseForRun($this->analysisRunId, $this->applicationId);
            $analysisRunService->mergeMetadata($this->analysisRunId, [
                'pipeline' => [
                    'resumeParse' => $parseSummary,
                ],
            ]);
            $analysisPipelinePersistenceService->logEvent([
                'analysisRunId' => $this->analysisRunId,
                'applicationId' => $this->applicationId,
                'candidateId' => $parseSummary['candidateId'] ?? null,
                'stage' => 'resume_parse',
                'eventKey' => 'analysis.resume_parse.completed',
                'message' => 'Parsing de curriculo processado.',
                'context' => [
                    'status' => $parseSummary['status'] ?? null,
                    'charCount' => $parseSummary['charCount'] ?? null,
                    'ocrUsed' => $parseSummary['ocrUsed'] ?? null,
                    'engine' => $parseSummary['engine'] ?? null,
                ],
            ]);

            $candidateId = is_string($parseSummary['candidateId'] ?? null)
                ? (string) $parseSummary['candidateId']
                : '';
            $detectedSkills = collect($parseSummary['detectedSkills'] ?? [])
                ->map(fn ($skill): string => trim((string) $skill))
                ->filter()
                ->values();

            if (($parseSummary['status'] ?? null) === 'completed' && $candidateId !== '') {
                $applicationSnapshot = $demoStateService->applicationAnalysis($this->applicationId);
                $candidateSnapshot = $applicationSnapshot['application']['candidate'] ?? [];
                $currentSkills = collect($candidateSnapshot['skills'] ?? [])
                    ->map(fn ($skill): string => trim((string) $skill))
                    ->filter()
                    ->values();

                $mergedSkills = $currentSkills
                    ->merge($detectedSkills)
                    ->unique(fn (string $skill): string => strtolower($skill))
                    ->values();

                $inferredExperienceYears = is_numeric($parseSummary['inferredExperienceYears'] ?? null)
                    ? (int) $parseSummary['inferredExperienceYears']
                    : 0;
                $currentExperienceYears = max(0, (int) ($candidateSnapshot['experience'] ?? 0));
                $nextExperienceYears = $inferredExperienceYears > 0
                    ? max($currentExperienceYears, min(45, $inferredExperienceYears))
                    : $currentExperienceYears;

                $educationSummary = is_string($parseSummary['educationSummary'] ?? null)
                    ? trim((string) $parseSummary['educationSummary'])
                    : '';
                $currentEducation = trim((string) ($candidateSnapshot['education'] ?? ''));
                $shouldUpdateEducation = $educationSummary !== ''
                    && (
                        $currentEducation === ''
                        || str_contains(strtolower($currentEducation), 'nao informado')
                    );

                $profileChanges = [];
                $skillsAdded = $mergedSkills->count() - $currentSkills->count();

                if ($skillsAdded > 0) {
                    $profileChanges['skills'] = $mergedSkills->all();
                }

                if ($nextExperienceYears > $currentExperienceYears) {
                    $profileChanges['experience'] = $nextExperienceYears;
                }

                if ($shouldUpdateEducation) {
                    $profileChanges['education'] = $educationSummary;
                }

                if ($profileChanges !== []) {
                    $demoStateService->updateCandidateProfile($candidateId, $profileChanges);
                }

                $analysisRunService->mergeMetadata($this->analysisRunId, [
                    'pipeline' => [
                        'candidateEnrichment' => [
                            'candidateId' => $candidateId,
                            'skillsAdded' => max(0, $skillsAdded),
                            'experienceUpdated' => $nextExperienceYears > $currentExperienceYears,
                            'educationUpdated' => $shouldUpdateEducation,
                            'inferredExperienceYears' => $inferredExperienceYears > 0 ? $inferredExperienceYears : null,
                            'detectedSkills' => $detectedSkills->all(),
                        ],
                    ],
                ]);
                $analysisPipelinePersistenceService->logEvent([
                    'analysisRunId' => $this->analysisRunId,
                    'applicationId' => $this->applicationId,
                    'candidateId' => $candidateId,
                    'stage' => 'candidate_enrichment',
                    'eventKey' => 'analysis.candidate_enrichment.applied',
                    'message' => 'Enriquecimento de perfil concluido.',
                    'context' => [
                        'skillsAdded' => max(0, $skillsAdded),
                        'experienceUpdated' => $nextExperienceYears > $currentExperienceYears,
                        'educationUpdated' => $shouldUpdateEducation,
                    ],
                ]);
            }

            $applicationSnapshot = $demoStateService->applicationAnalysis($this->applicationId);
            $applicationContext = is_array($applicationSnapshot['application'] ?? null)
                ? $applicationSnapshot['application']
                : [];
            $candidateContext = is_array($applicationContext['candidate'] ?? null)
                ? $applicationContext['candidate']
                : [];
            $jobContext = is_array($applicationContext['job'] ?? null)
                ? $applicationContext['job']
                : [];
            $sourceType = (string) ($candidateContext['submittedBy']['type'] ?? 'empresa');
            $llmInsights = $structuredAiAnalysisService->analyze([
                'applicationId' => $this->applicationId,
                'candidate' => $candidateContext,
                'job' => $jobContext,
                'resumeParse' => $parseSummary,
                'sourceType' => $sourceType,
            ]);

            $analysisRunService->mergeMetadata($this->analysisRunId, [
                'pipeline' => [
                    'llmInsights' => [
                        'status' => $llmInsights['status'] ?? null,
                        'provider' => $llmInsights['provider'] ?? null,
                        'model' => $llmInsights['model'] ?? null,
                        'attempts' => $llmInsights['attempts'] ?? null,
                        'errors' => $llmInsights['errors'] ?? [],
                        'payload' => $llmInsights['payload'] ?? [],
                    ],
                ],
            ]);
            $analysisPipelinePersistenceService->logEvent([
                'analysisRunId' => $this->analysisRunId,
                'applicationId' => $this->applicationId,
                'candidateId' => $candidateId !== '' ? $candidateId : null,
                'jobId' => $applicationContext['jobId'] ?? null,
                'stage' => 'llm_analysis',
                'eventKey' => 'analysis.llm.completed',
                'message' => 'Analise estruturada por IA concluida.',
                'context' => [
                    'status' => $llmInsights['status'] ?? null,
                    'provider' => $llmInsights['provider'] ?? null,
                    'model' => $llmInsights['model'] ?? null,
                    'attempts' => $llmInsights['attempts'] ?? null,
                ],
            ]);

            $demoStateService->processApplicationAnalysis($this->applicationId, $this->reprocess, [
                'resumeParse' => $parseSummary,
                'llmInsights' => $llmInsights,
                'sourceType' => $sourceType,
            ]);
            $exportPayload = $demoStateService->exportApplicationAnalysis($this->applicationId);
            $exportPayload['pipeline'] = [
                'resumeParse' => $parseSummary,
                'llmInsights' => $llmInsights,
            ];
            $reportMarkdown = is_string($exportPayload['reportMarkdown'] ?? null)
                ? (string) $exportPayload['reportMarkdown']
                : $demoStateService->buildAnalysisReportMarkdown($exportPayload);
            $pdfReport = $analysisReportDocumentService->generatePdfReport($this->analysisRunId, $reportMarkdown);
            $reportPdfUrl = is_string($pdfReport['reportPdfUrl'] ?? null)
                ? (string) $pdfReport['reportPdfUrl']
                : null;
            $exportPayload['reportPdfUrl'] = $reportPdfUrl;

            $analysis = is_array($exportPayload['analysis'] ?? null) ? $exportPayload['analysis'] : [];
            $aiAnalysis = is_array($analysis['aiAnalysis'] ?? null) ? $analysis['aiAnalysis'] : [];
            $analysisPipelinePersistenceService->upsertScore(
                $this->analysisRunId,
                $this->buildScorePayload($this->applicationId, $analysis, $aiAnalysis)
            );

            if ($candidateId !== '') {
                $analysisPipelinePersistenceService->upsertCandidateProfile(
                    $candidateId,
                    $this->analysisRunId,
                    is_numeric($parseSummary['resumeParseId'] ?? null) ? (int) $parseSummary['resumeParseId'] : null,
                    [
                        'detectedSkills' => $parseSummary['detectedSkills'] ?? [],
                        'educationSummary' => $parseSummary['educationSummary'] ?? null,
                        'inferredExperienceYears' => $parseSummary['inferredExperienceYears'] ?? null,
                        'aiSummary' => $llmInsights['payload']['summary'] ?? null,
                        'riskFlags' => $llmInsights['payload']['riskFlags'] ?? [],
                        'identitySignals' => $llmInsights['payload']['identitySignals'] ?? [],
                        'resumeSignals' => $aiAnalysis['resumeSignals'] ?? [],
                        'sourceType' => $sourceType,
                    ],
                    [
                        'resumeParse' => $parseSummary['confidence'] ?? [],
                        'llmConfidence' => $llmInsights['payload']['confidence'] ?? null,
                    ],
                );
            }

            $analysisPipelinePersistenceService->logEvent([
                'analysisRunId' => $this->analysisRunId,
                'applicationId' => $this->applicationId,
                'candidateId' => $candidateId !== '' ? $candidateId : null,
                'jobId' => $applicationContext['jobId'] ?? null,
                'stage' => 'report_generation',
                'eventKey' => 'analysis.report.generated',
                'message' => 'Relatorio da analise gerado.',
                'context' => [
                    'markdownLength' => strlen($reportMarkdown),
                    'hasSummary' => trim((string) ($aiAnalysis['summary'] ?? '')) !== '',
                    'pdfStatus' => $pdfReport['status'] ?? 'unknown',
                    'hasPdfUrl' => $reportPdfUrl !== null,
                ],
            ]);
            $analysisRunService->mergeMetadata($this->analysisRunId, [
                'pipeline' => [
                    'reportDocument' => [
                        'status' => $pdfReport['status'] ?? 'unknown',
                        'reportPdfUrl' => $reportPdfUrl,
                        'reportPdfPath' => $pdfReport['reportPdfPath'] ?? null,
                        'error' => $pdfReport['error'] ?? null,
                    ],
                ],
            ]);

            $analysisPipelinePersistenceService->logEvent([
                'analysisRunId' => $this->analysisRunId,
                'applicationId' => $this->applicationId,
                'candidateId' => $candidateId !== '' ? $candidateId : null,
                'jobId' => $applicationContext['jobId'] ?? null,
                'stage' => 'pipeline_complete',
                'eventKey' => 'analysis.pipeline.completed',
                'message' => 'Pipeline de analise concluido.',
                'durationMs' => (int) round((microtime(true) - $pipelineStartedAt) * 1000),
            ]);
            $analysisRunService->markCompleted($this->analysisRunId, $exportPayload, $reportMarkdown, $reportPdfUrl);
        } catch (Throwable $exception) {
            $failedCandidateId = is_array($parseSummary) ? ($parseSummary['candidateId'] ?? null) : null;
            $analysisPipelinePersistenceService->logEvent([
                'analysisRunId' => $this->analysisRunId,
                'applicationId' => $this->applicationId,
                'candidateId' => $failedCandidateId,
                'stage' => 'pipeline_failed',
                'level' => 'error',
                'eventKey' => 'analysis.pipeline.failed',
                'message' => $exception->getMessage(),
                'context' => [
                    'traceClass' => get_class($exception),
                ],
                'durationMs' => (int) round((microtime(true) - $pipelineStartedAt) * 1000),
            ]);
            $analysisRunService->markFailed($this->analysisRunId, $exception->getMessage());

            throw $exception;
        }
    }

    /**
     * @param  array<string, mixed>  $analysis
     * @param  array<string, mixed>  $aiAnalysis
     * @return array<string, mixed>
     */
    private function buildScorePayload(string $applicationId, array $analysis, array $aiAnalysis): array
    {
        return [
            'applicationId' => $applicationId,
            'candidateId' => $analysis['candidateId'] ?? null,
            'jobId' => $analysis['jobId'] ?? null,
            'overallScore' => $aiAnalysis['overallScore'] ?? null,
            'compatibilityScore' => $analysis['compatibilityScore'] ?? null,
            'consistencyScore' => $analysis['consistencyScore'] ?? ($aiAnalysis['consistencyScore'] ?? null),
            'dimensions' => [
                'technicalSkills' => $aiAnalysis['technicalSkills'] ?? null,
                'softSkills' => $aiAnalysis['softSkills'] ?? null,
                'experienceRelevance' => $aiAnalysis['experienceRelevance'] ?? null,
                'educationMatch' => $aiAnalysis['educationMatch'] ?? null,
                'cultureFit' => $aiAnalysis['cultureFit'] ?? null,
                'consistencyScore' => $analysis['consistencyScore'] ?? ($aiAnalysis['consistencyScore'] ?? null),
            ],
            'weights' => is_array($aiAnalysis['scoreWeights'] ?? null) ? $aiAnalysis['scoreWeights'] : null,
            'adjustments' => is_array($aiAnalysis['scoreAdjustments'] ?? null) ? $aiAnalysis['scoreAdjustments'] : null,
            'signals' => [
                'resumeSignals' => $aiAnalysis['resumeSignals'] ?? [],
                'identityConsistency' => $aiAnalysis['identityConsistency'] ?? [],
            ],
        ];
    }
}
