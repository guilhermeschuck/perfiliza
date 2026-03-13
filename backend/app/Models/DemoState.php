<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DemoState extends Model
{
    protected $fillable = [
        'key',
        'payload',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
        ];
    }
}
