<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnalysisScore extends Model
{
    protected $fillable = [
        'analysis_run_id',
        'application_id',
        'candidate_id',
        'job_id',
        'overall_score',
        'compatibility_score',
        'consistency_score',
        'dimensions_json',
        'weights_json',
        'adjustments_json',
        'signals_json',
        'calculated_at',
    ];

    protected function casts(): array
    {
        return [
            'dimensions_json' => 'array',
            'weights_json' => 'array',
            'adjustments_json' => 'array',
            'signals_json' => 'array',
            'calculated_at' => 'datetime',
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
