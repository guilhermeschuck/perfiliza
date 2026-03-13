<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessApplicationAnalysisJob;
use App\Models\AnalysisRun;
use App\Models\ResumeParse;
use App\Services\AnalysisRunService;
use App\Services\DemoStateService;
use Illuminate\Http\JsonResponse;

class ApplicationsController extends Controller
{
    public function analysis(
        string $applicationId,
        DemoStateService $demoStateService,
        AnalysisRunService $analysisRunService,
    ): JsonResponse
    {
        $payload = $demoStateService->applicationAnalysis($applicationId);

        return response()->json($this->appendPipelineContext($applicationId, $payload, $analysisRunService));
    }

    public function export(
        string $applicationId,
        DemoStateService $demoStateService,
        AnalysisRunService $analysisRunService,
    ): JsonResponse
    {
        $payload = $demoStateService->exportApplicationAnalysis($applicationId);

        return response()->json($this->appendPipelineContext($applicationId, $payload, $analysisRunService));
    }

    public function start(
        string $applicationId,
        DemoStateService $demoStateService,
        AnalysisRunService $analysisRunService,
    ): JsonResponse {
        return response()->json(
            $this->startProcessing($applicationId, false, $demoStateService, $analysisRunService)
        );
    }

    public function reprocess(
        string $applicationId,
        DemoStateService $demoStateService,
        AnalysisRunService $analysisRunService,
    ): JsonResponse {
        return response()->json(
            $this->startProcessing($applicationId, true, $demoStateService, $analysisRunService)
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function startProcessing(
        string $applicationId,
        bool $reprocess,
        DemoStateService $demoStateService,
        AnalysisRunService $analysisRunService,
    ): array {
        $current = $demoStateService->applicationAnalysis($applicationId);
        $application = $current['application'] ?? [];
        $queueEnabled = (bool) config('analysis.queue_enabled', false);
        $queueConnection = config('analysis.queue_connection');
        $queueName = config('analysis.queue_name');

        $analysisRun = $analysisRunService->createRun([
            'application_id' => $applicationId,
            'job_id' => $application['jobId'] ?? null,
            'candidate_id' => $application['candidateId'] ?? null,
            'status' => 'pending',
            'reprocess' => $reprocess,
            'trigger_source' => 'manual',
            'queue_connection' => is_string($queueConnection) ? $queueConnection : null,
            'queue_name' => is_string($queueName) ? $queueName : null,
            'model_name' => config('analysis.model_name'),
            'prompt_version' => config('analysis.prompt_version'),
        ]);

        if ($queueEnabled) {
            $pendingDispatch = ProcessApplicationAnalysisJob::dispatch(
                $analysisRun->id,
                $applicationId,
                $reprocess,
            );

            if (is_string($queueConnection) && $queueConnection !== '') {
                $pendingDispatch->onConnection($queueConnection);
            }

            if (is_string($queueName) && $queueName !== '') {
                $pendingDispatch->onQueue($queueName);
            }

            return [
                ...$current,
                'reprocessed' => $reprocess,
                'queued' => true,
                'analysisRun' => $analysisRunService->toPayload($analysisRun),
            ];
        }

        ProcessApplicationAnalysisJob::dispatchSync(
            $analysisRun->id,
            $applicationId,
            $reprocess,
        );

        $updated = $demoStateService->applicationAnalysis($applicationId);

        return [
            ...$updated,
            'reprocessed' => $reprocess,
            'queued' => false,
            'analysisRun' => $analysisRunService->toPayload($analysisRunService->findOrFail($analysisRun->id)),
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function appendPipelineContext(
        string $applicationId,
        array $payload,
        AnalysisRunService $analysisRunService,
    ): array {
        $analysisRun = AnalysisRun::query()
            ->with([
                'reports' => fn ($query) => $query->latest('id'),
                'score',
                'candidateProfileAi',
            ])
            ->where('application_id', $applicationId)
            ->latest('id')
            ->first();

        if (! $analysisRun) {
            return $payload;
        }

        $resumeParse = ResumeParse::query()
            ->where('analysis_run_id', $analysisRun->id)
            ->latest('id')
            ->first();
        $latestReport = $analysisRun->reports
            ->sortByDesc('id')
            ->first();

        return [
            ...$payload,
            'analysisRun' => $analysisRunService->toPayload($analysisRun),
            'resumeParse' => $resumeParse
                ? [
                    'id' => $resumeParse->id,
                    'resumeId' => $resumeParse->resume_id,
                    'analysisRunId' => $resumeParse->analysis_run_id,
                    'status' => $resumeParse->parse_status,
                    'ocrUsed' => (bool) $resumeParse->ocr_used,
                    'language' => $resumeParse->language,
                    'charCount' => is_string($resumeParse->raw_text) ? strlen($resumeParse->raw_text) : 0,
                    'parsedAt' => $resumeParse->parsed_at?->toDateTimeString(),
                    'errorMessage' => $resumeParse->error_message,
                    'normalized' => is_array($resumeParse->normalized_json) ? $resumeParse->normalized_json : null,
                    'confidence' => is_array($resumeParse->confidence_json) ? $resumeParse->confidence_json : null,
                ]
                : null,
            'analysisScore' => $analysisRun->score
                ? [
                    'overallScore' => $analysisRun->score->overall_score,
                    'compatibilityScore' => $analysisRun->score->compatibility_score,
                    'consistencyScore' => $analysisRun->score->consistency_score,
                    'dimensions' => $analysisRun->score->dimensions_json,
                    'weights' => $analysisRun->score->weights_json,
                    'adjustments' => $analysisRun->score->adjustments_json,
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
            'reportDocument' => $latestReport
                ? [
                    'reportId' => $latestReport->id,
                    'format' => $latestReport->format,
                    'hasMarkdown' => is_string($latestReport->report_markdown) && trim($latestReport->report_markdown) !== '',
                    'pdfUrl' => $latestReport->report_pdf_url,
                    'generatedAt' => $latestReport->generated_at?->toDateTimeString(),
                ]
                : null,
        ];
    }
}
