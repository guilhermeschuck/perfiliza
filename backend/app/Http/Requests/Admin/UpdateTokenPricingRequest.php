<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateTokenPricingRequest extends FormRequest
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
            'pricing' => ['required', 'array'],
            'pricing.campaign_create' => ['sometimes', 'integer', 'min:1', 'max:10000'],
            'pricing.job_create' => ['sometimes', 'integer', 'min:1', 'max:10000'],
            'pricing.resume_analysis_start' => ['sometimes', 'integer', 'min:1', 'max:10000'],
            'pricing.resume_analysis_reprocess' => ['sometimes', 'integer', 'min:1', 'max:10000'],
        ];
    }
}
