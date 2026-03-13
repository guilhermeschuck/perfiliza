<?php

namespace App\Http\Requests\PublicJobs;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreLeadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $discAnswers = $this->input('discAnswers', []);
        if (is_string($discAnswers)) {
            $decoded = json_decode($discAnswers, true);
            $discAnswers = is_array($decoded) ? $decoded : [];
        }

        $customAnswers = $this->input('customAnswers', []);
        if (is_string($customAnswers)) {
            $decoded = json_decode($customAnswers, true);
            $customAnswers = is_array($decoded) ? $decoded : [];
        }

        $this->merge([
            'discAnswers' => $discAnswers,
            'customAnswers' => $customAnswers,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email'],
            'phone' => ['required', 'string', 'max:255'],
            'location' => ['required', 'string', 'max:255'],
            'linkedinUrl' => ['nullable', 'url', 'max:255'],
            'experienceRange' => ['required', Rule::in(['0-1', '2-3', '4-5', '6+'])],
            'education' => ['required', 'string', 'max:255'],
            'skills' => ['required', 'string', 'max:1000'],
            'resumeFile' => ['nullable', 'file', 'mimes:pdf,doc,docx', 'max:5120'],
            'discAnswers' => ['required', 'array'],
            'discAnswers.dominance' => ['required', 'integer', 'min:0', 'max:100'],
            'discAnswers.influence' => ['required', 'integer', 'min:0', 'max:100'],
            'discAnswers.steadiness' => ['required', 'integer', 'min:0', 'max:100'],
            'discAnswers.conscientiousness' => ['required', 'integer', 'min:0', 'max:100'],
            'customAnswers' => ['nullable', 'array'],
            'customAnswers.*.questionId' => ['required', 'string', 'max:100'],
            'customAnswers.*.question' => ['required', 'string', 'max:255'],
            'customAnswers.*.answer' => ['required', 'string', 'max:4000'],
        ];
    }
}
