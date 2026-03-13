<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnalysisReport extends Model
{
    protected $fillable = [
        'analysis_run_id',
        'format',
        'report_json',
        'report_markdown',
        'report_pdf_url',
        'generated_at',
    ];

    protected function casts(): array
    {
        return [
            'report_json' => 'array',
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
}
