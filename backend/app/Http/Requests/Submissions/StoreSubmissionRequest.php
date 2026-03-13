<?php

namespace App\Http\Requests\Submissions;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSubmissionRequest extends FormRequest
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
            'jobId' => ['required', 'string'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email'],
            'phone' => ['nullable', 'string', 'max:255'],
            'location' => ['required', 'string', 'max:255'],
            'linkedinUrl' => ['nullable', 'url', 'max:255'],
            'experienceRange' => ['required', Rule::in(['0-1', '2-3', '4-5', '6+'])],
            'education' => ['required', 'string', 'max:255'],
            'skills' => ['required', 'string', 'max:1000'],
            'resumeFile' => ['nullable', 'file', 'mimes:pdf,doc,docx', 'max:10240'],
            'resumeFileName' => ['nullable', 'string', 'max:255'],
            'resumeUrl' => ['nullable', 'url', 'max:2048'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
