<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreJobRequest extends FormRequest
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
            'title' => ['required', 'string', 'max:255'],
            'companyId' => ['nullable', 'string', 'max:100'],
            'department' => ['required', 'string', 'max:255'],
            'location' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in(['CLT', 'PJ', 'Estagio', 'Estágio', 'Freelancer'])],
            'level' => ['required', Rule::in(['Junior', 'Júnior', 'Pleno', 'Senior', 'Sênior', 'Especialista'])],
            'salary' => ['nullable', 'array'],
            'salary.min' => ['required_with:salary', 'integer', 'min:0'],
            'salary.max' => ['required_with:salary', 'integer', 'min:0', 'gte:salary.min'],
            'description' => ['required', 'string', 'max:5000'],
            'requirements' => ['nullable', 'array'],
            'requirements.*' => ['required', 'string', 'max:255'],
            'benefits' => ['nullable', 'array'],
            'benefits.*' => ['required', 'string', 'max:255'],
            'status' => ['nullable', Rule::in(['active', 'paused', 'closed'])],
            'customQuestions' => ['nullable', 'array'],
            'customQuestions.*.id' => ['nullable', 'string', 'max:100'],
            'customQuestions.*.label' => ['required', 'string', 'max:255'],
            'customQuestions.*.type' => ['required', Rule::in(['text', 'textarea'])],
            'customQuestions.*.required' => ['required', 'boolean'],
            'customQuestions.*.placeholder' => ['nullable', 'string', 'max:255'],
            'scoreWeights' => ['nullable', 'array'],
            'scoreWeights.technicalSkills' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'scoreWeights.softSkills' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'scoreWeights.experienceRelevance' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'scoreWeights.educationMatch' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'scoreWeights.cultureFit' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'scoreWeights.consistencyScore' => ['sometimes', 'numeric', 'min:0', 'max:1'],
        ];
    }
}
