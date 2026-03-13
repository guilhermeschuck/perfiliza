<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class StructuredAiAnalysisService
{
    /**
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    public function analyze(array $context): array
    {
        $provider = Str::lower((string) config('analysis.ai_provider', 'mock'));
        $maxRetries = max(0, (int) config('analysis.ai_max_retries', 2));
        $attempts = 0;
        $errors = [];

        for ($attempt = 1; $attempt <= ($maxRetries + 1); $attempt++) {
            $attempts = $attempt;

            try {
                $responsePayload = $provider === 'openai'
                    ? $this->analyzeWithOpenAi($context)
                    : $this->mockResponse($context);

                $normalized = $this->validateAndNormalize($responsePayload);

                return [
                    'status' => 'completed',
                    'provider' => $provider,
                    'model' => $provider === 'openai'
                        ? (string) config('analysis.ai_model', 'gpt-4.1-mini')
                        : 'mock-analysis-v1',
                    'attempts' => $attempts,
                    'errors' => $errors,
                    'payload' => $normalized,
                ];
            } catch (\Throwable $exception) {
                $errors[] = [
                    'attempt' => $attempt,
                    'message' => $exception->getMessage(),
                ];

                if ($attempt < ($maxRetries + 1)) {
                    usleep($attempt * 150000);
                }
            }
        }

        $fallback = $this->validateAndNormalize($this->mockResponse($context));

        return [
            'status' => 'fallback',
            'provider' => 'mock',
            'model' => 'mock-analysis-v1',
            'attempts' => $attempts,
            'errors' => $errors,
            'payload' => $fallback,
        ];
    }

    /**
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function analyzeWithOpenAi(array $context): array
    {
        $apiKey = trim((string) config('analysis.ai_api_key', ''));

        if ($apiKey === '') {
            throw new \RuntimeException('OPENAI_API_KEY nao configurada.');
        }

        $endpoint = (string) config('analysis.ai_endpoint', 'https://api.openai.com/v1/chat/completions');
        $model = (string) config('analysis.ai_model', 'gpt-4.1-mini');
        $timeout = max(5, (int) config('analysis.ai_timeout_seconds', 20));
        $trimmedContext = [
            'candidate' => $context['candidate'] ?? [],
            'job' => $context['job'] ?? [],
            'resumeParse' => $context['resumeParse'] ?? [],
            'sourceType' => $context['sourceType'] ?? null,
        ];

        $systemPrompt = implode("\n", [
            'Voce e um analisador de curriculos para recrutamento.',
            'Responda estritamente em JSON valido.',
            'Campos obrigatorios: summary, strengths, weaknesses, recommendations, riskFlags, scoringHints, identitySignals, confidence.',
            'scoringHints deve conter technicalBoost, experienceBoost, educationBoost, cultureBoost (inteiros entre -10 e 10).',
            'identitySignals deve conter linkedinConflict e divergenceReason.',
            'Nao inclua markdown, comentario ou texto fora do JSON.',
        ]);

        $response = Http::timeout($timeout)
            ->withToken($apiKey)
            ->post($endpoint, [
                'model' => $model,
                'temperature' => 0.1,
                'response_format' => ['type' => 'json_object'],
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => $systemPrompt,
                    ],
                    [
                        'role' => 'user',
                        'content' => json_encode($trimmedContext, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    ],
                ],
            ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Falha no provider OpenAI: HTTP '.$response->status());
        }

        $content = (string) $response->json('choices.0.message.content');

        if (trim($content) === '') {
            throw new \RuntimeException('Resposta vazia do provider OpenAI.');
        }

        try {
            /** @var array<string, mixed>|null $decoded */
            $decoded = json_decode($content, true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            throw new \RuntimeException('JSON invalido retornado pelo provider OpenAI.');
        }

        if (! is_array($decoded)) {
            throw new \RuntimeException('Payload de IA em formato invalido.');
        }

        return $decoded;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function validateAndNormalize(array $payload): array
    {
        $validator = Validator::make($payload, [
            'summary' => ['required', 'string', 'min:20', 'max:1000'],
            'strengths' => ['required', 'array', 'min:1', 'max:6'],
            'strengths.*' => ['required', 'string', 'max:220'],
            'weaknesses' => ['required', 'array', 'min:1', 'max:6'],
            'weaknesses.*' => ['required', 'string', 'max:220'],
            'recommendations' => ['required', 'array', 'min:1', 'max:8'],
            'recommendations.*' => ['required', 'string', 'max:240'],
            'riskFlags' => ['present', 'array', 'max:8'],
            'riskFlags.*' => ['required', 'string', 'max:220'],
            'scoringHints' => ['required', 'array'],
            'scoringHints.technicalBoost' => ['required', 'integer', 'between:-10,10'],
            'scoringHints.experienceBoost' => ['required', 'integer', 'between:-10,10'],
            'scoringHints.educationBoost' => ['required', 'integer', 'between:-10,10'],
            'scoringHints.cultureBoost' => ['required', 'integer', 'between:-10,10'],
            'identitySignals' => ['required', 'array'],
            'identitySignals.linkedinConflict' => ['required', 'boolean'],
            'identitySignals.divergenceReason' => ['nullable', 'string', 'max:500'],
            'confidence' => ['required', 'numeric', 'between:0,1'],
        ]);

        if ($validator->fails()) {
            throw new \RuntimeException('Schema invalido na resposta de IA.');
        }

        /** @var array<string, mixed> $safe */
        $safe = $validator->validated();

        return [
            'summary' => (string) $safe['summary'],
            'strengths' => collect($safe['strengths'] ?? [])->map(fn ($item): string => (string) $item)->values()->all(),
            'weaknesses' => collect($safe['weaknesses'] ?? [])->map(fn ($item): string => (string) $item)->values()->all(),
            'recommendations' => collect($safe['recommendations'] ?? [])->map(fn ($item): string => (string) $item)->values()->all(),
            'riskFlags' => collect($safe['riskFlags'] ?? [])->map(fn ($item): string => (string) $item)->values()->all(),
            'scoringHints' => [
                'technicalBoost' => (int) ($safe['scoringHints']['technicalBoost'] ?? 0),
                'experienceBoost' => (int) ($safe['scoringHints']['experienceBoost'] ?? 0),
                'educationBoost' => (int) ($safe['scoringHints']['educationBoost'] ?? 0),
                'cultureBoost' => (int) ($safe['scoringHints']['cultureBoost'] ?? 0),
            ],
            'identitySignals' => [
                'linkedinConflict' => (bool) ($safe['identitySignals']['linkedinConflict'] ?? false),
                'divergenceReason' => isset($safe['identitySignals']['divergenceReason'])
                    ? (string) $safe['identitySignals']['divergenceReason']
                    : null,
            ],
            'confidence' => (float) $safe['confidence'],
        ];
    }

    /**
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function mockResponse(array $context): array
    {
        $resumeParse = is_array($context['resumeParse'] ?? null) ? $context['resumeParse'] : [];
        $candidate = is_array($context['candidate'] ?? null) ? $context['candidate'] : [];
        $job = is_array($context['job'] ?? null) ? $context['job'] : [];
        $detectedSkillsCount = count(is_array($resumeParse['detectedSkills'] ?? null) ? $resumeParse['detectedSkills'] : []);
        $experienceHintsCount = max(0, (int) ($resumeParse['experienceHintsCount'] ?? 0));
        $hasLinkedinFromParse = count(is_array($resumeParse['extractedLinkedinUrls'] ?? null) ? $resumeParse['extractedLinkedinUrls'] : []) > 0;
        $hasLinkedinProfile = trim((string) ($candidate['linkedinUrl'] ?? '')) !== '';
        $sourceType = (string) ($context['sourceType'] ?? ($candidate['submittedBy']['type'] ?? 'empresa'));
        $hasLinkedinMatchSignal = array_key_exists('linkedinMatched', $resumeParse);
        $linkedinConflict = $hasLinkedinFromParse && $hasLinkedinProfile && $hasLinkedinMatchSignal
            ? ! (bool) ($resumeParse['linkedinMatched'] ?? false)
            : false;
        $jobTitle = (string) ($job['title'] ?? 'vaga');

        return [
            'summary' => 'Analise automatizada para '.$jobTitle.' com base em sinais de curriculo, perfil e compatibilidade comportamental.',
            'strengths' => [
                $detectedSkillsCount > 0
                    ? 'Curriculo com skills tecnicas detectadas automaticamente.'
                    : 'Perfil apresenta base tecnica aderente ao contexto da vaga.',
                $experienceHintsCount > 0
                    ? 'Historico de experiencia com evidencias extraidas do curriculo.'
                    : 'Experiencia profissional declarada em linha com o nivel esperado.',
            ],
            'weaknesses' => [
                $hasLinkedinProfile
                    ? 'Pode ampliar provas de impacto com casos e metricas objetivas.'
                    : 'Ausencia de LinkedIn no perfil reduz capacidade de validacao externa.',
            ],
            'recommendations' => [
                'Validar profundidade tecnica com desafio pratico.',
                'Confirmar aderencia cultural com entrevista estruturada.',
            ],
            'riskFlags' => $linkedinConflict
                ? ['Possivel divergencia entre LinkedIn informado e detectado no curriculo.']
                : [],
            'scoringHints' => [
                'technicalBoost' => $detectedSkillsCount > 0 ? 2 : 0,
                'experienceBoost' => $experienceHintsCount > 0 ? 2 : 0,
                'educationBoost' => 0,
                'cultureBoost' => $sourceType === 'candidato' ? 1 : 0,
            ],
            'identitySignals' => [
                'linkedinConflict' => $linkedinConflict,
                'divergenceReason' => $linkedinConflict
                    ? 'URL detectada no curriculo diferente do perfil informado.'
                    : null,
            ],
            'confidence' => 0.71,
        ];
    }
}
