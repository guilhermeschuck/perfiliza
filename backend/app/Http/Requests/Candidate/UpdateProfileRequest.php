<?php

namespace App\Http\Requests\Candidate;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
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
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email'],
            'phone' => ['sometimes', 'string', 'max:255'],
            'location' => ['sometimes', 'string', 'max:255'],
            'linkedinUrl' => ['nullable', 'url', 'max:255'],
            'education' => ['sometimes', 'string', 'max:255'],
            'currentPosition' => ['nullable', 'string', 'max:255'],
            'currentCompany' => ['nullable', 'string', 'max:255'],
            'experience' => ['sometimes', 'integer', 'min:0', 'max:60'],
            'skills' => ['sometimes', 'array'],
            'skills.*' => ['required', 'string', 'max:100'],
            'status' => ['sometimes', Rule::in(['available', 'employed', 'open_to_offers'])],
            'bio' => ['nullable', 'string', 'max:3000'],
        ];
    }
}
