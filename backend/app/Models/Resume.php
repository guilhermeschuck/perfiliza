<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Resume extends Model
{
    protected $fillable = [
        'candidate_id',
        'application_id',
        'source',
        'file_name',
        'file_url',
        'file_hash',
        'mime',
        'size_bytes',
        'uploaded_at',
    ];

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
            'uploaded_at' => 'datetime',
        ];
    }

    /**
     * @return HasMany<ResumeParse, $this>
     */
    public function parses(): HasMany
    {
        return $this->hasMany(ResumeParse::class);
    }
}
