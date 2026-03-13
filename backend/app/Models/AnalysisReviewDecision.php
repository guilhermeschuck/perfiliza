<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnalysisReviewDecision extends Model
{
    protected $fillable = [
        'analysis_run_id',
        'application_id',
        'candidate_id',
        'job_id',
        'reviewer_id',
        'decision',
        'rationale',
        'tags_json',
        'decided_at',
    ];

    protected function casts(): array
    {
        return [
            'tags_json' => 'array',
            'decided_at' => 'datetime',
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
