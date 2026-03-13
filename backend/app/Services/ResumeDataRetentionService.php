<?php

namespace App\Services;

use App\Models\ResumeParse;
use Illuminate\Support\Carbon;

class ResumeDataRetentionService
{
    public function __construct(
        private readonly AnalysisPipelinePersistenceService $analysisPipelinePersistenceService,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function purgeRawText(?int $days = null): array
    {
        $retentionDays = max(1, $days ?? (int) config('analysis.raw_text_retention_days', 30));
        $cutoff = Carbon::now()->subDays($retentionDays);
        $redactedCount = 0;
        $runsTouched = [];

        $parses = ResumeParse::query()
            ->whereNotNull('raw_text')
            ->where(function ($query) use ($cutoff): void {
                $query->where('parsed_at', '<=', $cutoff)
                    ->orWhere(function ($nested) use ($cutoff): void {
                        $nested->whereNull('parsed_at')
                            ->where('created_at', '<=', $cutoff);
                    });
            })
            ->get();

        foreach ($parses as $parse) {
            $normalized = is_array($parse->normalized_json) ? $parse->normalized_json : [];
            $normalized['rawTextRedacted'] = true;
            $normalized['rawTextRedactedAt'] = Carbon::now()->toDateTimeString();
            $normalized['rawTextRetentionDays'] = $retentionDays;

            $parse->raw_text = null;
            $parse->normalized_json = $normalized;
            $parse->save();

            $redactedCount++;

            if ($parse->analysis_run_id) {
                $runsTouched[] = (int) $parse->analysis_run_id;
                $this->analysisPipelinePersistenceService->logEvent([
                    'analysisRunId' => (int) $parse->analysis_run_id,
                    'stage' => 'lgpd_retention_cleanup',
                    'eventKey' => 'analysis.lgpd.raw_text_redacted',
                    'message' => 'Texto bruto do curriculo removido por politica de retencao.',
                    'context' => [
                        'resumeParseId' => $parse->id,
                        'retentionDays' => $retentionDays,
                    ],
                    'lgpdPurpose' => 'conformidade_e_governanca',
                    'lgpdLegalBasis' => 'cumprimento_de_obrigacao_legal_ou_regulatoria',
                ]);
            }
        }

        return [
            'retentionDays' => $retentionDays,
            'cutoff' => $cutoff->toDateTimeString(),
            'redactedCount' => $redactedCount,
            'runsTouched' => collect($runsTouched)->unique()->values()->all(),
        ];
    }
}
