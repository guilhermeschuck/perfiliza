<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAnalysisReviewDecisionRequest extends FormRequest
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
            'reviewerId' => ['required', 'string', 'max:120'],
            'decision' => ['required', Rule::in(['approved', 'rejected', 'needs_review', 'escalated'])],
            'rationale' => ['required', 'string', 'max:3000'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['required', 'string', 'max:80'],
        ];
    }
}
