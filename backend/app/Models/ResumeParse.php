<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ResumeParse extends Model
{
    protected $fillable = [
        'resume_id',
        'analysis_run_id',
        'parse_status',
        'ocr_used',
        'language',
        'raw_text',
        'normalized_json',
        'confidence_json',
        'error_message',
        'parsed_at',
    ];

    protected function casts(): array
    {
        return [
            'ocr_used' => 'boolean',
            'normalized_json' => 'array',
            'confidence_json' => 'array',
            'parsed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Resume, $this>
     */
    public function resume(): BelongsTo
    {
        return $this->belongsTo(Resume::class);
    }

    /**
     * @return BelongsTo<AnalysisRun, $this>
     */
    public function analysisRun(): BelongsTo
    {
        return $this->belongsTo(AnalysisRun::class);
    }
}
