<?php

namespace App\Http\Requests\Candidate;

use Illuminate\Foundation\Http\FormRequest;

class StoreResumeRequest extends FormRequest
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
            'candidateId' => ['required', 'string'],
            'resumeFile' => ['required', 'file', 'mimes:pdf,doc,docx', 'max:10240'],
        ];
    }
}
