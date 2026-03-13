<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSettingsRequest extends FormRequest
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
            'role' => ['required', Rule::in(['admin', 'empresa', 'candidato'])],
            'userId' => ['required', 'string'],
            'settings' => ['required', 'array'],
            'settings.displayName' => ['sometimes', 'string', 'max:255'],
            'settings.email' => ['sometimes', 'email'],
            'settings.workspace' => ['sometimes', 'string', 'max:255'],
            'settings.notes' => ['sometimes', 'string', 'max:5000'],
            'settings.browserAlerts' => ['sometimes', 'boolean'],
            'settings.emailDigest' => ['sometimes', 'boolean'],
            'settings.smartRecommendations' => ['sometimes', 'boolean'],
            'settings.profileVisibility' => ['sometimes', 'boolean'],
            'settings.timezone' => ['sometimes', 'string', 'max:100'],
        ];
    }
}
