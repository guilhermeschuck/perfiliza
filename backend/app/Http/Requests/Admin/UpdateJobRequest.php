<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateJobRequest extends FormRequest
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
            'title' => ['sometimes', 'string', 'max:255'],
            'companyId' => ['sometimes', 'string', 'max:100'],
            'department' => ['sometimes', 'string', 'max:255'],
            'location' => ['sometimes', 'string', 'max:255'],
            'type' => ['sometimes', Rule::in(['CLT', 'PJ', 'Estagio', 'Estágio', 'Freelancer'])],
            'level' => ['sometimes', Rule::in(['Junior', 'Júnior', 'Pleno', 'Senior', 'Sênior', 'Especialista'])],
            'salary' => ['sometimes', 'nullable', 'array'],
            'salary.min' => ['required_with:salary', 'integer', 'min:0'],
            'salary.max' => ['required_with:salary', 'integer', 'min:0', 'gte:salary.min'],
            'description' => ['sometimes', 'string', 'max:5000'],
            'requirements' => ['sometimes', 'array'],
            'requirements.*' => ['required', 'string', 'max:255'],
            'benefits' => ['sometimes', 'array'],
            'benefits.*' => ['required', 'string', 'max:255'],
            'status' => ['sometimes', Rule::in(['active', 'paused', 'closed'])],
            'customQuestions' => ['sometimes', 'array'],
            'customQuestions.*.id' => ['nullable', 'string', 'max:100'],
            'customQuestions.*.label' => ['required', 'string', 'max:255'],
            'customQuestions.*.type' => ['required', Rule::in(['text', 'textarea'])],
            'customQuestions.*.required' => ['required', 'boolean'],
            'customQuestions.*.placeholder' => ['nullable', 'string', 'max:255'],
            'scoreWeights' => ['sometimes', 'array'],
            'scoreWeights.technicalSkills' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'scoreWeights.softSkills' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'scoreWeights.experienceRelevance' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'scoreWeights.educationMatch' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'scoreWeights.cultureFit' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'scoreWeights.consistencyScore' => ['sometimes', 'numeric', 'min:0', 'max:1'],
        ];
    }
}
