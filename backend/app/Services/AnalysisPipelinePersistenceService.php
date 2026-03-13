<?php

namespace App\Services;

use App\Models\AnalysisAuditLog;
use App\Models\AnalysisScore;
use App\Models\CandidateProfileAi;
use Illuminate\Support\Carbon;

class AnalysisPipelinePersistenceService
{
    /**
     * @param  array<string, mixed>  $event
     */
    public function logEvent(array $event): AnalysisAuditLog
    {
        return AnalysisAuditLog::query()->create([
            'analysis_run_id' => isset($event['analysisRunId']) ? (int) $event['analysisRunId'] : null,
            'application_id' => isset($event['applicationId']) ? (string) $event['applicationId'] : null,
            'candidate_id' => isset($event['candidateId']) ? (string) $event['candidateId'] : null,
            'job_id' => isset($event['jobId']) ? (string) $event['jobId'] : null,
            'stage' => (string) ($event['stage'] ?? 'pipeline'),
            'level' => (string) ($event['level'] ?? 'info'),
            'event_key' => isset($event['eventKey']) ? (string) $event['eventKey'] : null,
            'message' => isset($event['message']) ? (string) $event['message'] : null,
            'context_json' => is_array($event['context'] ?? null) ? $event['context'] : null,
            'lgpd_purpose' => isset($event['lgpdPurpose']) ? (string) $event['lgpdPurpose'] : 'recrutamento_e_selecao',
            'lgpd_legal_basis' => isset($event['lgpdLegalBasis']) ? (string) $event['lgpdLegalBasis'] : 'execucao_de_procedimentos_pre_contratuais',
            'duration_ms' => is_numeric($event['durationMs'] ?? null) ? max(0, (int) $event['durationMs']) : null,
            'happened_at' => $this->toCarbon($event['happenedAt'] ?? null) ?? Carbon::now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $profile
     * @param  array<string, mixed>|null  $confidence
     */
    public function upsertCandidateProfile(
        string $candidateId,
        int $analysisRunId,
        ?int $resumeParseId,
        array $profile,
        ?array $confidence = null,
        string $profileVersion = 'v1',
    ): CandidateProfileAi {
        return CandidateProfileAi::query()->updateOrCreate(
            ['candidate_id' => $candidateId],
            [
                'analysis_run_id' => $analysisRunId,
                'resume_parse_id' => $resumeParseId,
                'profile_json' => $profile,
                'confidence_json' => $confidence,
                'profile_version' => $profileVersion,
                'updated_by' => 'pipeline',
                'generated_at' => Carbon::now(),
            ],
        );
    }

    /**
     * @param  array<string, mixed>  $scorePayload
     */
    public function upsertScore(int $analysisRunId, array $scorePayload): AnalysisScore
    {
        return AnalysisScore::query()->updateOrCreate(
            ['analysis_run_id' => $analysisRunId],
            [
                'application_id' => (string) ($scorePayload['applicationId'] ?? ''),
                'candidate_id' => isset($scorePayload['candidateId']) ? (string) $scorePayload['candidateId'] : null,
                'job_id' => isset($scorePayload['jobId']) ? (string) $scorePayload['jobId'] : null,
                'overall_score' => $this->nullableScore($scorePayload['overallScore'] ?? null),
                'compatibility_score' => $this->nullableScore($scorePayload['compatibilityScore'] ?? null),
                'consistency_score' => $this->nullableScore($scorePayload['consistencyScore'] ?? null),
                'dimensions_json' => is_array($scorePayload['dimensions'] ?? null) ? $scorePayload['dimensions'] : null,
                'weights_json' => is_array($scorePayload['weights'] ?? null) ? $scorePayload['weights'] : null,
                'adjustments_json' => is_array($scorePayload['adjustments'] ?? null) ? $scorePayload['adjustments'] : null,
                'signals_json' => is_array($scorePayload['signals'] ?? null) ? $scorePayload['signals'] : null,
                'calculated_at' => $this->toCarbon($scorePayload['calculatedAt'] ?? null) ?? Carbon::now(),
            ],
        );
    }

    private function nullableScore(mixed $value): ?int
    {
        if (! is_numeric($value)) {
            return null;
        }

        return max(0, min(100, (int) $value));
    }

    private function toCarbon(mixed $value): ?Carbon
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
}
