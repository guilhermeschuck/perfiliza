<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class AnalysisRun extends Model
{
    protected $fillable = [
        'application_id',
        'job_id',
        'candidate_id',
        'status',
        'reprocess',
        'trigger_source',
        'queue_connection',
        'queue_name',
        'model_name',
        'prompt_version',
        'started_at',
        'finished_at',
        'error_message',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'reprocess' => 'boolean',
            'metadata' => 'array',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    /**
     * @return HasMany<AnalysisReport, $this>
     */
    public function reports(): HasMany
    {
        return $this->hasMany(AnalysisReport::class);
    }

    /**
     * @return HasMany<AnalysisAuditLog, $this>
     */
    public function auditLogs(): HasMany
    {
        return $this->hasMany(AnalysisAuditLog::class);
    }

    /**
     * @return HasOne<AnalysisScore, $this>
     */
    public function score(): HasOne
    {
        return $this->hasOne(AnalysisScore::class);
    }

    /**
     * @return HasOne<CandidateProfileAi, $this>
     */
    public function candidateProfileAi(): HasOne
    {
        return $this->hasOne(CandidateProfileAi::class);
    }

    /**
     * @return HasMany<AnalysisReviewDecision, $this>
     */
    public function reviewDecisions(): HasMany
    {
        return $this->hasMany(AnalysisReviewDecision::class);
    }
}
