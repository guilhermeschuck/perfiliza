<?php

namespace App\Http\Requests\Company;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ConsumeTokensRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'companyId' => ['required', 'string', 'max:100'],
            'action' => ['required', Rule::in([
                'campaign_create',
                'job_create',
                'resume_analysis_start',
                'resume_analysis_reprocess',
            ])],
            'description' => ['nullable', 'string', 'max:255'],
            'metadata' => ['nullable', 'array'],
        ];
    }
}
