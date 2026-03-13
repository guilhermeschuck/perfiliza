<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnalysisAuditLog extends Model
{
    protected $fillable = [
        'analysis_run_id',
        'application_id',
        'candidate_id',
        'job_id',
        'stage',
        'level',
        'event_key',
        'message',
        'context_json',
        'lgpd_purpose',
        'lgpd_legal_basis',
        'duration_ms',
        'happened_at',
    ];

    protected function casts(): array
    {
        return [
            'context_json' => 'array',
            'happened_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<AnalysisRun, $this>
     */
    public function analysisRun(): BelongsTo
    {
        return $this->belongsTo(AnalysisRun::class);
    }
}
