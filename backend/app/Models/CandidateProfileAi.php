<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CandidateProfileAi extends Model
{
    protected $table = 'candidate_profiles_ai';

    protected $fillable = [
        'candidate_id',
        'analysis_run_id',
        'resume_parse_id',
        'profile_version',
        'profile_json',
        'confidence_json',
        'updated_by',
        'generated_at',
    ];

    protected function casts(): array
    {
        return [
            'profile_json' => 'array',
            'confidence_json' => 'array',
            'generated_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<AnalysisRun, $this>
     */
    public function analysisRun(): BelongsTo
    {
        return $this->belongsTo(AnalysisRun::class);
    }

    /**
     * @return BelongsTo<ResumeParse, $this>
     */
    public function resumeParse(): BelongsTo
    {
        return $this->belongsTo(ResumeParse::class);
    }
}
