<?php

namespace App\Services;

use App\Models\DemoState;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use JsonException;

class DemoStateService
{
    private const STATE_KEY = 'perfiliza_state';
    private const DEFAULT_COMPANY_TOKEN_BALANCE = 120;
    private const TOKEN_PRICING_DEFAULTS = [
        'campaign_create' => 24,
        'job_create' => 18,
        'resume_analysis_start' => 8,
        'resume_analysis_reprocess' => 5,
    ];
    private const TOKEN_ACTIONS = [
        'campaign_create' => 'Criacao de campanha',
        'job_create' => 'Criacao de vaga',
        'resume_analysis_start' => 'Analise de curriculo',
        'resume_analysis_reprocess' => 'Reprocessamento de analise',
    ];
    private const DEFAULT_SCORE_WEIGHTS = [
        'technicalSkills' => 0.124,
        'softSkills' => 0.124,
        'experienceRelevance' => 0.254,
        'educationMatch' => 0.124,
        'cultureFit' => 0.274,
        'consistencyScore' => 0.10,
    ];

    public function bootstrap(): array
    {
        return $this->decorate($this->state());
    }

    public function login(string $role, ?string $email = null): ?array
    {
        $users = collect($this->state()['users'] ?? []);

        if ($email) {
            $user = $users->first(
                fn (array $user): bool => strcasecmp($user['email'], $email) === 0 && $user['role'] === $role
            );

            if ($user) {
                return $user;
            }
        }

        return $users->first(fn (array $user): bool => $user['role'] === $role);
    }

    public function synchronizeUserFromAccount(User $account): ?array
    {
        $state = $this->state();
        $state = $this->synchronizeUsersWithAccounts($state, collect([$account]));
        $state = $this->ensureCandidateProfilesForAccounts($state, collect([$account]));
        $this->store($state);

        return collect($state['users'] ?? [])->firstWhere('id', (string) $account->id);
    }

    public function resetState(): void
    {
        $this->store($this->fallbackPayload());
    }

    public function companyTokens(string $companyId, int $limit = 20): array
    {
        $state = $this->state();
        $wallet = $this->companyWalletFromState($state, $companyId);
        $transactions = $this->companyTokenTransactionsFromState($state, $companyId, $limit);

        return [
            'companyId' => $companyId,
            'pricing' => $state['tokenPricing'] ?? self::TOKEN_PRICING_DEFAULTS,
            'actions' => $this->tokenActionsCatalog($state),
            'wallet' => $wallet,
            'transactions' => $transactions,
        ];
    }

    public function purchaseCompanyTokens(string $companyId, int $tokens, ?string $note = null): array
    {
        $state = $this->state();
        $state = $this->creditCompanyTokens(
            $state,
            $companyId,
            $tokens,
            'token_purchase',
            $note && trim($note) !== '' ? trim($note) : 'Compra de pacote de tokens.',
            [
                'tokensPurchased' => $tokens,
                'note' => $note,
            ],
        );

        $this->store($state);

        return [
            'companyId' => $companyId,
            'tokensAdded' => $tokens,
            'wallet' => $this->companyWalletFromState($state, $companyId),
            'pricing' => $state['tokenPricing'] ?? self::TOKEN_PRICING_DEFAULTS,
            'transactions' => $this->companyTokenTransactionsFromState($state, $companyId, 20),
        ];
    }

    public function consumeCompanyTokens(string $companyId, string $action, array $metadata = []): array
    {
        $state = $this->state();
        $state = $this->debitCompanyTokens(
            $state,
            $companyId,
            $action,
            $metadata['description'] ?? null,
            $metadata,
        );

        $this->store($state);

        return [
            'companyId' => $companyId,
            'action' => $action,
            'wallet' => $this->companyWalletFromState($state, $companyId),
            'pricing' => $state['tokenPricing'] ?? self::TOKEN_PRICING_DEFAULTS,
            'transactions' => $this->companyTokenTransactionsFromState($state, $companyId, 20),
        ];
    }

    public function companyTokenTransactions(string $companyId, int $limit = 20): array
    {
        return [
            'companyId' => $companyId,
            'transactions' => $this->companyTokenTransactionsFromState($this->state(), $companyId, $limit),
        ];
    }

    public function tokenPricing(): array
    {
        $state = $this->state();

        return [
            'pricing' => $state['tokenPricing'] ?? self::TOKEN_PRICING_DEFAULTS,
            'actions' => $this->tokenActionsCatalog($state),
        ];
    }

    public function updateTokenPricing(array $pricing): array
    {
        $state = $this->state();
        $updatedPricing = $state['tokenPricing'] ?? self::TOKEN_PRICING_DEFAULTS;

        foreach ($pricing as $action => $cost) {
            if (! isset(self::TOKEN_ACTIONS[$action])) {
                continue;
            }

            $updatedPricing[$action] = max(1, (int) $cost);
        }

        $state['tokenPricing'] = $this->normalizeTokenPricing($updatedPricing);
        $this->store($state);

        return [
            'pricing' => $state['tokenPricing'],
            'actions' => $this->tokenActionsCatalog($state),
            'updatedAt' => now()->toDateTimeString(),
        ];
    }

    public function publicJob(string $shareToken): ?array
    {
        return collect($this->state()['jobs'] ?? [])->firstWhere('shareToken', $shareToken);
    }

    public function createSubmission(array $input): array
    {
        $result = $this->appendSubmissionToState($this->state(), $input);

        $this->store($result['state']);

        return [
            'candidate' => $result['candidate'],
            'application' => $result['application'],
            'bootstrap' => $this->decorate($result['state']),
        ];
    }

    public function createLead(string $shareToken, array $input): array
    {
        $state = $this->state();
        $job = collect($state['jobs'] ?? [])->firstWhere('shareToken', $shareToken);

        if (! $job) {
            throw ValidationException::withMessages([
                'shareToken' => 'A vaga compartilhada nao foi encontrada.',
            ]);
        }

        $now = Carbon::now();
        $skills = $this->normalizeSkills($input['skills']);
        $discAnswers = $this->normalizeDiscAnswers($input['discAnswers'] ?? []);
        $customAnswers = $this->normalizeCustomAnswers($input['customAnswers'] ?? []);

        $lead = [
            'id' => $this->nextId($state['leads'] ?? []),
            'jobId' => $job['id'],
            'companyId' => $job['companyId'],
            'name' => $input['name'],
            'email' => $input['email'],
            'phone' => $input['phone'],
            'location' => $input['location'],
            'linkedinUrl' => ($input['linkedinUrl'] ?? null) ?: null,
            'resumeUrl' => $input['resumeUrl'] ?? null,
            'resumeFileName' => ($input['resumeFileName'] ?? null) ?: null,
            'experienceRange' => $input['experienceRange'],
            'experience' => $this->normalizeExperience($input['experienceRange']),
            'education' => $input['education'],
            'skills' => $skills,
            'discAnswers' => $discAnswers,
            'customAnswers' => $customAnswers,
            'status' => 'new',
            'createdAt' => $now->toDateString(),
            'applicationId' => null,
        ];

        $state['leads'] = [...($state['leads'] ?? []), $lead];
        $this->store($state);

        return [
            'lead' => $lead,
            'job' => collect($this->state()['jobs'] ?? [])->firstWhere('id', $job['id']),
        ];
    }

    public function updateJobForm(string $jobId, array $questions): array
    {
        $state = $this->state();
        $jobUpdated = false;

        $state['jobs'] = collect($state['jobs'] ?? [])
            ->map(function (array $job) use ($jobId, $questions, &$jobUpdated): array {
                if ($job['id'] !== $jobId) {
                    return $job;
                }

                $jobUpdated = true;
                $job['customQuestions'] = $this->normalizeQuestions($questions);

                return $job;
            })
            ->values()
            ->all();

        if (! $jobUpdated) {
            throw ValidationException::withMessages([
                'jobId' => 'A vaga selecionada nao foi encontrada.',
            ]);
        }

        $this->store($state);

        return [
            'job' => collect($this->state()['jobs'] ?? [])->firstWhere('id', $jobId),
            'bootstrap' => $this->decorate($this->state()),
        ];
    }

    public function submitLead(string $jobId, string $leadId): array
    {
        $state = $this->state();
        $lead = collect($state['leads'] ?? [])->firstWhere('id', $leadId);

        if (! $lead || $lead['jobId'] !== $jobId) {
            throw ValidationException::withMessages([
                'leadId' => 'O lead selecionado nao foi encontrado para esta vaga.',
            ]);
        }

        if (($lead['status'] ?? 'new') === 'submitted') {
            throw ValidationException::withMessages([
                'leadId' => 'Este lead ja foi submetido para analise.',
            ]);
        }

        $result = $this->appendSubmissionToState($state, [
            'jobId' => $jobId,
            'name' => $lead['name'],
            'email' => $lead['email'],
            'phone' => $lead['phone'],
            'location' => $lead['location'],
            'linkedinUrl' => $lead['linkedinUrl'] ?? null,
            'resumeUrl' => $lead['resumeUrl'] ?? null,
            'experienceRange' => $lead['experienceRange'],
            'education' => $lead['education'],
            'skills' => $lead['skills'],
            'resumeFileName' => $lead['resumeFileName'] ?? null,
            'notes' => 'Lead convertido do formulario publico.',
        ]);

        $result['state']['leads'] = collect($result['state']['leads'] ?? [])
            ->map(function (array $existingLead) use ($leadId, $result): array {
                if ($existingLead['id'] !== $leadId) {
                    return $existingLead;
                }

                $existingLead['status'] = 'submitted';
                $existingLead['applicationId'] = $result['application']['id'];

                return $existingLead;
            })
            ->values()
            ->all();

        $this->store($result['state']);

        return [
            'candidate' => $result['candidate'],
            'application' => $result['application'],
            'bootstrap' => $this->decorate($result['state']),
        ];
    }

    public function createJob(array $input): array
    {
        $state = $this->state();
        $companyId = (string) ($input['companyId'] ?? '2');
        $users = collect($state['users'] ?? []);
        $companyUser = $users->first(fn (array $user): bool => ($user['id'] ?? null) === $companyId);

        $state = $this->debitCompanyTokens(
            $state,
            $companyId,
            'campaign_create',
            'Criacao de campanha de recrutamento.',
            [
                'title' => (string) ($input['title'] ?? ''),
                'source' => 'admin.jobs.store',
            ],
        );

        $jobId = $this->nextId($state['jobs'] ?? []);

        $job = [
            'id' => $jobId,
            'title' => (string) $input['title'],
            'company' => (string) ($companyUser['company'] ?? $companyUser['name'] ?? 'Empresa'),
            'companyId' => $companyId,
            'department' => (string) $input['department'],
            'location' => (string) $input['location'],
            'type' => (string) ($input['type'] ?? 'CLT'),
            'level' => (string) ($input['level'] ?? 'Pleno'),
            'salary' => $this->normalizeSalary($input['salary'] ?? null),
            'description' => (string) $input['description'],
            'requirements' => $this->normalizeStringList($input['requirements'] ?? []),
            'benefits' => $this->normalizeStringList($input['benefits'] ?? []),
            'status' => (string) ($input['status'] ?? 'active'),
            'createdAt' => Carbon::now()->toDateString(),
            'applicationsCount' => 0,
            'shareToken' => $this->shareTokenForJob([
                'title' => $input['title'],
                'id' => $jobId,
            ]),
            'scoreWeights' => $this->normalizeScoreWeights(
                is_array($input['scoreWeights'] ?? null) ? $input['scoreWeights'] : []
            ),
        ];

        $job['customQuestions'] = $this->normalizeQuestions(
            $input['customQuestions'] ?? $this->defaultQuestionsForJob($job)
        );

        $state['jobs'] = [...($state['jobs'] ?? []), $job];

        $this->store($state);
        $bootstrap = $this->decorate($this->state());

        return [
            'job' => collect($bootstrap['jobs'] ?? [])->firstWhere('id', $jobId),
            'bootstrap' => $bootstrap,
        ];
    }

    public function updateJob(string $jobId, array $input): array
    {
        $state = $this->state();
        $users = collect($state['users'] ?? []);
        $jobUpdated = false;

        $state['jobs'] = collect($state['jobs'] ?? [])
            ->map(function (array $job) use ($jobId, $input, $users, &$jobUpdated): array {
                if ($job['id'] !== $jobId) {
                    return $job;
                }

                $jobUpdated = true;

                if (array_key_exists('title', $input)) {
                    $job['title'] = (string) $input['title'];
                }

                if (array_key_exists('companyId', $input)) {
                    $job['companyId'] = (string) $input['companyId'];
                    $companyUser = $users->first(fn (array $user): bool => ($user['id'] ?? null) === $job['companyId']);
                    $job['company'] = (string) ($companyUser['company'] ?? $companyUser['name'] ?? $job['company'] ?? 'Empresa');
                }

                if (array_key_exists('department', $input)) {
                    $job['department'] = (string) $input['department'];
                }

                if (array_key_exists('location', $input)) {
                    $job['location'] = (string) $input['location'];
                }

                if (array_key_exists('type', $input)) {
                    $job['type'] = (string) $input['type'];
                }

                if (array_key_exists('level', $input)) {
                    $job['level'] = (string) $input['level'];
                }

                if (array_key_exists('description', $input)) {
                    $job['description'] = (string) $input['description'];
                }

                if (array_key_exists('requirements', $input)) {
                    $job['requirements'] = $this->normalizeStringList((array) $input['requirements']);
                }

                if (array_key_exists('benefits', $input)) {
                    $job['benefits'] = $this->normalizeStringList((array) $input['benefits']);
                }

                if (array_key_exists('salary', $input)) {
                    $job['salary'] = $this->normalizeSalary($input['salary']);
                }

                if (array_key_exists('status', $input)) {
                    $job['status'] = (string) $input['status'];
                }

                if (array_key_exists('customQuestions', $input)) {
                    $job['customQuestions'] = $this->normalizeQuestions((array) $input['customQuestions']);
                }

                if (array_key_exists('scoreWeights', $input)) {
                    $job['scoreWeights'] = $this->normalizeScoreWeights((array) $input['scoreWeights']);
                }

                if (! isset($job['shareToken']) || $job['shareToken'] === '') {
                    $job['shareToken'] = $this->shareTokenForJob($job);
                }

                return $job;
            })
            ->values()
            ->all();

        if (! $jobUpdated) {
            throw ValidationException::withMessages([
                'jobId' => 'A vaga selecionada nao foi encontrada.',
            ]);
        }

        $updatedJob = collect($state['jobs'] ?? [])->firstWhere('id', $jobId);

        $state['applications'] = collect($state['applications'] ?? [])
            ->map(function (array $application) use ($jobId, $updatedJob): array {
                if (($application['jobId'] ?? null) !== $jobId || ! is_array($updatedJob)) {
                    return $application;
                }

                $application['job'] = $updatedJob;

                return $application;
            })
            ->values()
            ->all();

        $this->store($state);
        $bootstrap = $this->decorate($state);

        return [
            'job' => collect($bootstrap['jobs'] ?? [])->firstWhere('id', $jobId),
            'bootstrap' => $bootstrap,
        ];
    }

    public function deleteJob(string $jobId): array
    {
        $state = $this->state();
        $job = collect($state['jobs'] ?? [])->firstWhere('id', $jobId);

        if (! $job) {
            throw ValidationException::withMessages([
                'jobId' => 'A vaga selecionada nao foi encontrada.',
            ]);
        }

        $applicationsToRemove = collect($state['applications'] ?? [])
            ->where('jobId', $jobId)
            ->values();

        $analysisIds = $applicationsToRemove
            ->pluck('analysis.id')
            ->filter(fn ($analysisId): bool => is_string($analysisId) && $analysisId !== '')
            ->values()
            ->all();

        $state['jobs'] = collect($state['jobs'] ?? [])
            ->reject(fn (array $existingJob): bool => $existingJob['id'] === $jobId)
            ->values()
            ->all();

        $state['applications'] = collect($state['applications'] ?? [])
            ->reject(fn (array $application): bool => ($application['jobId'] ?? null) === $jobId)
            ->values()
            ->all();

        $state['analyses'] = collect($state['analyses'] ?? [])
            ->reject(function (array $analysis) use ($jobId, $analysisIds): bool {
                return ($analysis['jobId'] ?? null) === $jobId
                    || in_array($analysis['id'] ?? null, $analysisIds, true);
            })
            ->values()
            ->all();

        $state['leads'] = collect($state['leads'] ?? [])
            ->reject(fn (array $lead): bool => ($lead['jobId'] ?? null) === $jobId)
            ->values()
            ->all();

        $this->store($state);

        return [
            'deletedJobId' => $jobId,
            'bootstrap' => $this->decorate($state),
        ];
    }

    public function updateJobStatus(string $jobId, string $status): array
    {
        $state = $this->state();
        $jobUpdated = false;

        $state['jobs'] = collect($state['jobs'] ?? [])
            ->map(function (array $job) use ($jobId, $status, &$jobUpdated): array {
                if ($job['id'] !== $jobId) {
                    return $job;
                }

                $jobUpdated = true;
                $job['status'] = $status;

                return $job;
            })
            ->values()
            ->all();

        if (! $jobUpdated) {
            throw ValidationException::withMessages([
                'jobId' => 'A vaga selecionada nao foi encontrada.',
            ]);
        }

        $state['applications'] = collect($state['applications'] ?? [])
            ->map(function (array $application) use ($jobId, $status): array {
                if (($application['jobId'] ?? null) !== $jobId) {
                    return $application;
                }

                $application['job']['status'] = $status;

                return $application;
            })
            ->values()
            ->all();

        $this->store($state);
        $bootstrap = $this->decorate($state);

        return [
            'job' => collect($bootstrap['jobs'] ?? [])->firstWhere('id', $jobId),
            'bootstrap' => $bootstrap,
        ];
    }

    public function jobCandidates(string $jobId): array
    {
        $bootstrap = $this->bootstrap();
        $job = collect($bootstrap['jobs'] ?? [])->firstWhere('id', $jobId);

        if (! $job) {
            throw ValidationException::withMessages([
                'jobId' => 'A vaga selecionada nao foi encontrada.',
            ]);
        }

        $applications = collect($bootstrap['applications'] ?? [])
            ->where('jobId', $jobId)
            ->sortByDesc('submittedAt')
            ->values()
            ->all();

        return [
            'job' => $job,
            'applications' => $applications,
            'total' => count($applications),
        ];
    }

    public function applicationAnalysis(string $applicationId): array
    {
        $bootstrap = $this->bootstrap();
        $application = collect($bootstrap['applications'] ?? [])->firstWhere('id', $applicationId);

        if (! $application) {
            throw ValidationException::withMessages([
                'applicationId' => 'A candidatura selecionada nao foi encontrada.',
            ]);
        }

        return [
            'application' => $application,
            'analysis' => $application['analysis'] ?? null,
        ];
    }

    /**
     * @param  array<string, mixed>|null  $pipelineContext
     */
    public function processApplicationAnalysis(
        string $applicationId,
        bool $reprocess = false,
        ?array $pipelineContext = null,
    ): array
    {
        $state = $this->state();
        $application = collect($state['applications'] ?? [])->firstWhere('id', $applicationId);

        if (! $application) {
            throw ValidationException::withMessages([
                'applicationId' => 'A candidatura selecionada nao foi encontrada.',
            ]);
        }

        $candidate = $application['candidate']
            ?? collect($state['candidates'] ?? [])->firstWhere('id', $application['candidateId'] ?? null);

        if (! is_array($candidate)) {
            throw ValidationException::withMessages([
                'candidateId' => 'O candidato da candidatura nao foi encontrado.',
            ]);
        }

        $companyId = (string) ($application['companyId'] ?? $application['job']['companyId'] ?? '');

        if ($companyId === '') {
            throw ValidationException::withMessages([
                'companyId' => 'Nao foi possivel identificar a empresa responsavel pela analise.',
            ]);
        }

        $state = $this->debitCompanyTokens(
            $state,
            $companyId,
            $reprocess ? 'resume_analysis_reprocess' : 'resume_analysis_start',
            $reprocess
                ? 'Reprocessamento de analise de curriculo.'
                : 'Analise de curriculo iniciada.',
            [
                'applicationId' => $applicationId,
                'jobId' => $application['jobId'] ?? null,
                'candidateId' => $application['candidateId'] ?? null,
                'source' => $reprocess ? 'admin.applications.analysis.reprocess' : 'admin.applications.analysis.start',
            ],
        );

        $existingApplicationAnalysis = is_array($application['analysis'] ?? null)
            ? $application['analysis']
            : null;

        $analysisId = (string) (
            $existingApplicationAnalysis['id']
            ?? $this->nextId($state['analyses'] ?? [])
        );

        $analysisCreatedAt = (string) (
            $existingApplicationAnalysis['createdAt']
            ?? Carbon::now()->toDateString()
        );

        $completedAnalysis = $this->buildCompletedAnalysis(
            $analysisId,
            $application,
            $candidate,
            $analysisCreatedAt,
            $pipelineContext,
        );
        $analysisUpdated = false;

        $state['analyses'] = collect($state['analyses'] ?? [])
            ->map(function (array $analysis) use ($analysisId, $completedAnalysis, &$analysisUpdated): array {
                if ($analysis['id'] !== $analysisId) {
                    return $analysis;
                }

                $analysisUpdated = true;

                return $completedAnalysis;
            })
            ->values()
            ->all();

        if (! $analysisUpdated) {
            $state['analyses'] = [...($state['analyses'] ?? []), $completedAnalysis];
        }

        $state['applications'] = collect($state['applications'] ?? [])
            ->map(function (array $existingApplication) use ($applicationId, $completedAnalysis, $reprocess): array {
                if ($existingApplication['id'] !== $applicationId) {
                    return $existingApplication;
                }

                $nextStatus = $reprocess
                    ? (string) ($existingApplication['status'] ?? 'analyzed')
                    : 'analyzed';

                if (! in_array($nextStatus, ['analyzed', 'reviewed', 'approved', 'rejected'], true)) {
                    $nextStatus = 'analyzed';
                }

                $existingApplication['analysis'] = $completedAnalysis;
                $existingApplication['status'] = $nextStatus;

                return $existingApplication;
            })
            ->values()
            ->all();

        $this->store($state);
        $bootstrap = $this->decorate($state);
        $updatedApplication = collect($bootstrap['applications'] ?? [])->firstWhere('id', $applicationId);

        return [
            'application' => $updatedApplication,
            'analysis' => $updatedApplication['analysis'] ?? $completedAnalysis,
            'reprocessed' => $reprocess,
            'bootstrap' => $bootstrap,
        ];
    }

    public function candidateProfile(string $candidateId): array
    {
        $candidate = collect($this->bootstrap()['candidates'] ?? [])->firstWhere('id', $candidateId);

        if (! $candidate) {
            throw ValidationException::withMessages([
                'candidateId' => 'O candidato informado nao foi encontrado.',
            ]);
        }

        return [
            'candidate' => $candidate,
        ];
    }

    public function updateCandidateProfile(string $candidateId, array $input): array
    {
        $state = $this->state();
        $changes = [];

        foreach ([
            'name',
            'email',
            'phone',
            'location',
            'linkedinUrl',
            'education',
            'currentPosition',
            'currentCompany',
            'status',
            'bio',
        ] as $field) {
            if (array_key_exists($field, $input)) {
                $changes[$field] = $input[$field];
            }
        }

        if (array_key_exists('experience', $input)) {
            $changes['experience'] = (int) $input['experience'];
        }

        if (array_key_exists('skills', $input)) {
            $changes['skills'] = $this->normalizeStringList((array) $input['skills']);
        }

        $result = $this->updateCandidateAndApplications($state, $candidateId, $changes);
        $state = $result['state'];

        $state['users'] = collect($state['users'] ?? [])
            ->map(function (array $user) use ($candidateId, $changes): array {
                if (($user['id'] ?? null) !== $candidateId) {
                    return $user;
                }

                if (array_key_exists('name', $changes)) {
                    $user['name'] = (string) $changes['name'];
                }

                if (array_key_exists('email', $changes)) {
                    $user['email'] = (string) $changes['email'];
                }

                return $user;
            })
            ->values()
            ->all();

        $this->store($state);
        $bootstrap = $this->decorate($state);

        return [
            'candidate' => collect($bootstrap['candidates'] ?? [])->firstWhere('id', $candidateId),
            'bootstrap' => $bootstrap,
        ];
    }

    public function candidateResume(string $candidateId): array
    {
        $candidate = collect($this->bootstrap()['candidates'] ?? [])->firstWhere('id', $candidateId);

        if (! $candidate) {
            throw ValidationException::withMessages([
                'candidateId' => 'O candidato informado nao foi encontrado.',
            ]);
        }

        return [
            'candidateId' => $candidateId,
            'resumeFileName' => $candidate['resumeFileName'] ?? null,
            'resumeUrl' => $candidate['resumeUrl'] ?? null,
            'hasResume' => ! empty($candidate['resumeUrl'] ?? null),
            'updatedAt' => $candidate['updatedAt'] ?? $candidate['createdAt'] ?? null,
        ];
    }

    public function updateCandidateResume(string $candidateId, string $resumeFileName, string $resumeUrl): array
    {
        $state = $this->state();
        $result = $this->updateCandidateAndApplications($state, $candidateId, [
            'resumeFileName' => $resumeFileName,
            'resumeUrl' => $resumeUrl,
            'updatedAt' => Carbon::now()->toDateString(),
        ]);

        $this->store($result['state']);

        return [
            'candidateId' => $candidateId,
            'resumeFileName' => $resumeFileName,
            'resumeUrl' => $resumeUrl,
            'hasResume' => true,
        ];
    }

    public function deleteCandidateResume(string $candidateId): array
    {
        $state = $this->state();
        $result = $this->updateCandidateAndApplications($state, $candidateId, [
            'resumeFileName' => null,
            'resumeUrl' => null,
            'updatedAt' => Carbon::now()->toDateString(),
        ]);

        $this->store($result['state']);

        return [
            'candidateId' => $candidateId,
            'resumeFileName' => null,
            'resumeUrl' => null,
            'hasResume' => false,
        ];
    }

    public function candidateSavedJobs(string $candidateId): array
    {
        $state = $this->state();
        $this->ensureCandidateExists($state, $candidateId);
        $jobIds = collect($state['candidateSavedJobs'][$candidateId] ?? [])
            ->filter(fn ($jobId): bool => is_string($jobId) && trim($jobId) !== '')
            ->map(fn (string $jobId): string => trim($jobId))
            ->unique()
            ->values();

        $validJobIds = collect($state['jobs'] ?? [])
            ->map(fn (array $job): string => (string) ($job['id'] ?? ''))
            ->filter()
            ->values();

        $filteredJobIds = $jobIds
            ->filter(fn (string $jobId): bool => $validJobIds->contains($jobId))
            ->values();

        if ($filteredJobIds->all() !== $jobIds->all()) {
            $state['candidateSavedJobs'][$candidateId] = $filteredJobIds->all();
            $this->store($state);
        }

        return [
            'candidateId' => $candidateId,
            'jobIds' => $filteredJobIds->all(),
        ];
    }

    public function saveCandidateJob(string $candidateId, string $jobId): array
    {
        $state = $this->state();
        $this->ensureCandidateExists($state, $candidateId);
        $job = collect($state['jobs'] ?? [])->firstWhere('id', $jobId);

        if (! is_array($job)) {
            throw ValidationException::withMessages([
                'jobId' => 'A vaga informada nao foi encontrada.',
            ]);
        }

        $jobIds = collect($state['candidateSavedJobs'][$candidateId] ?? [])
            ->push($jobId)
            ->filter(fn ($value): bool => is_string($value) && trim($value) !== '')
            ->map(fn (string $value): string => trim($value))
            ->unique()
            ->values()
            ->all();

        $state['candidateSavedJobs'][$candidateId] = $jobIds;
        $this->store($state);

        return [
            'candidateId' => $candidateId,
            'jobIds' => $jobIds,
        ];
    }

    public function removeCandidateSavedJob(string $candidateId, string $jobId): array
    {
        $state = $this->state();
        $this->ensureCandidateExists($state, $candidateId);

        $jobIds = collect($state['candidateSavedJobs'][$candidateId] ?? [])
            ->filter(fn ($value): bool => is_string($value) && trim($value) !== '' && trim($value) !== $jobId)
            ->map(fn (string $value): string => trim($value))
            ->unique()
            ->values()
            ->all();

        $state['candidateSavedJobs'][$candidateId] = $jobIds;
        $this->store($state);

        return [
            'candidateId' => $candidateId,
            'jobIds' => $jobIds,
        ];
    }

    public function candidateNotifications(string $candidateId): array
    {
        $state = $this->state();
        $bootstrap = $this->decorate($state);

        $applications = collect($bootstrap['applications'] ?? [])
            ->where('candidateId', $candidateId)
            ->sortByDesc('submittedAt')
            ->values();

        $statusMessages = [
            'submitted' => 'Seu perfil foi enviado e esta aguardando triagem.',
            'analyzing' => 'Sua analise esta em andamento pela plataforma.',
            'analyzed' => 'Sua analise foi concluida e esta disponivel para revisao.',
            'reviewed' => 'Seu perfil foi revisado pela empresa responsavel.',
            'approved' => 'Parabens! Seu perfil avancou para a proxima etapa.',
            'rejected' => 'A empresa encerrou esta candidatura no momento.',
        ];

        $readIds = collect($state['notificationReads'][$candidateId] ?? [])->values();

        $notifications = $applications
            ->take(20)
            ->map(function (array $application) use ($readIds, $statusMessages): array {
                $status = $application['status'] ?? 'submitted';
                $withdrawnByCandidate = (bool) ($application['withdrawnByCandidate'] ?? false);
                $jobTitle = (string) ($application['job']['title'] ?? 'vaga');
                $notificationId = 'application-'.$application['id'];

                return [
                    'id' => $notificationId,
                    'type' => 'application_status',
                    'title' => 'Atualizacao da vaga '.$jobTitle,
                    'message' => $withdrawnByCandidate
                        ? 'Voce retirou essa candidatura.'
                        : ($statusMessages[$status] ?? 'Houve uma atualizacao na sua candidatura.'),
                    'read' => $readIds->contains($notificationId),
                    'createdAt' => (string) ($application['submittedAt'] ?? now()->toDateString()),
                    'href' => '/candidato/candidaturas/'.$application['id'],
                ];
            })
            ->values();

        if ($notifications->isEmpty()) {
            $welcomeId = 'welcome';
            $notifications = collect([
                [
                    'id' => $welcomeId,
                    'type' => 'platform',
                    'title' => 'Bem-vindo ao portal do candidato',
                    'message' => 'Complete seu perfil para receber recomendacoes mais precisas.',
                    'read' => $readIds->contains($welcomeId),
                    'createdAt' => now()->toDateString(),
                    'href' => '/candidato/perfil',
                ],
            ]);
        }

        return [
            'notifications' => $notifications->all(),
        ];
    }

    public function markCandidateNotificationRead(string $candidateId, string $notificationId): array
    {
        $state = $this->state();
        $readIds = collect($state['notificationReads'][$candidateId] ?? [])
            ->push($notificationId)
            ->filter(fn ($value): bool => is_string($value) && $value !== '')
            ->unique()
            ->values()
            ->all();

        $state['notificationReads'][$candidateId] = $readIds;
        $this->store($state);

        return $this->candidateNotifications($candidateId);
    }

    public function withdrawCandidateApplication(string $candidateId, string $applicationId): array
    {
        $state = $this->state();
        $this->ensureCandidateExists($state, $candidateId);
        $targetApplication = collect($state['applications'] ?? [])
            ->first(fn (array $application): bool => (
                (string) ($application['id'] ?? '') === $applicationId
                && (string) ($application['candidateId'] ?? '') === $candidateId
            ));

        if (! is_array($targetApplication)) {
            throw ValidationException::withMessages([
                'applicationId' => 'A candidatura informada nao foi encontrada para este candidato.',
            ]);
        }

        $alreadyWithdrawn = (bool) ($targetApplication['withdrawnByCandidate'] ?? false);
        $status = (string) ($targetApplication['status'] ?? 'submitted');

        if ($alreadyWithdrawn) {
            $bootstrap = $this->decorate($state);
            $application = collect($bootstrap['applications'] ?? [])->firstWhere('id', $applicationId);

            return [
                'application' => $application,
                'bootstrap' => $bootstrap,
            ];
        }

        if ($status === 'rejected') {
            throw ValidationException::withMessages([
                'applicationId' => 'Nao e possivel retirar uma candidatura ja encerrada pela empresa.',
            ]);
        }

        $now = Carbon::now()->toDateString();

        $state['applications'] = collect($state['applications'] ?? [])
            ->map(function (array $application) use ($applicationId, $now): array {
                if ((string) ($application['id'] ?? '') !== $applicationId) {
                    return $application;
                }

                $existingNotes = trim((string) ($application['notes'] ?? ''));
                $withdrawnNote = 'Candidatura retirada pelo candidato em '.$now.'.';

                $application['status'] = 'rejected';
                $application['withdrawnByCandidate'] = true;
                $application['withdrawnAt'] = $now;
                $application['notes'] = $existingNotes !== ''
                    ? $existingNotes."\n".$withdrawnNote
                    : $withdrawnNote;

                return $application;
            })
            ->values()
            ->all();

        $this->store($state);
        $bootstrap = $this->decorate($state);
        $application = collect($bootstrap['applications'] ?? [])->firstWhere('id', $applicationId);

        return [
            'application' => $application,
            'bootstrap' => $bootstrap,
        ];
    }

    public function userSettings(string $role, string $userId): array
    {
        $state = $this->state();
        $settings = [
            ...$this->defaultSettings($state, $role, $userId),
            ...($state['settings'][$role][$userId] ?? []),
        ];

        return [
            'role' => $role,
            'userId' => $userId,
            'settings' => $settings,
        ];
    }

    public function saveUserSettings(string $role, string $userId, array $settings): array
    {
        $state = $this->state();
        $state['settings'][$role] ??= [];
        $state['settings'][$role][$userId] = [
            ...$this->defaultSettings($state, $role, $userId),
            ...($state['settings'][$role][$userId] ?? []),
            ...$settings,
        ];

        $state['users'] = collect($state['users'] ?? [])
            ->map(function (array $user) use ($userId, $settings, $role): array {
                if (($user['id'] ?? null) !== $userId) {
                    return $user;
                }

                if (isset($settings['displayName']) && is_string($settings['displayName'])) {
                    $user['name'] = $settings['displayName'];
                }

                if (isset($settings['email']) && is_string($settings['email'])) {
                    $user['email'] = $settings['email'];
                }

                if ($role === 'empresa' && isset($settings['workspace']) && is_string($settings['workspace'])) {
                    $user['company'] = $settings['workspace'];
                }

                return $user;
            })
            ->values()
            ->all();

        $this->store($state);
        $saved = $this->userSettings($role, $userId);
        $saved['savedAt'] = now()->toDateTimeString();

        return $saved;
    }

    public function companyReportFunnel(string $companyId): array
    {
        $applications = collect($this->bootstrap()['applications'] ?? [])
            ->where('companyId', $companyId)
            ->values();
        $total = max(1, $applications->count());

        $stages = collect([
            'submitted' => 'Submetidos',
            'analyzing' => 'Em analise',
            'analyzed' => 'Analisados',
            'reviewed' => 'Em revisao',
            'approved' => 'Aprovados',
            'rejected' => 'Rejeitados',
        ])->map(function (string $label, string $status) use ($applications, $total): array {
            $count = $applications->where('status', $status)->count();

            return [
                'status' => $status,
                'label' => $label,
                'count' => $count,
                'percentage' => round(($count / $total) * 100, 2),
            ];
        })->values()->all();

        return [
            'companyId' => $companyId,
            'totalApplications' => $applications->count(),
            'stages' => $stages,
        ];
    }

    public function companyReportSources(string $companyId): array
    {
        $bootstrap = $this->bootstrap();
        $applications = collect($bootstrap['applications'] ?? [])
            ->where('companyId', $companyId)
            ->values();
        $leads = collect($bootstrap['leads'] ?? [])
            ->where('companyId', $companyId)
            ->values();

        $sources = [
            [
                'source' => 'Candidatura direta',
                'key' => 'candidate_direct',
                'count' => $applications
                    ->filter(fn (array $application): bool => ($application['candidate']['submittedBy']['type'] ?? null) === 'candidato')
                    ->count(),
            ],
            [
                'source' => 'Submissao por empresa',
                'key' => 'company_submission',
                'count' => $applications
                    ->filter(fn (array $application): bool => ($application['candidate']['submittedBy']['type'] ?? null) === 'empresa')
                    ->count(),
            ],
            [
                'source' => 'Leads via link publico',
                'key' => 'public_leads',
                'count' => $leads->count(),
            ],
        ];

        $total = max(1, collect($sources)->sum('count'));

        $items = collect($sources)
            ->map(function (array $source) use ($total): array {
                return [
                    ...$source,
                    'percentage' => round(($source['count'] / $total) * 100, 2),
                ];
            })
            ->values()
            ->all();

        return [
            'companyId' => $companyId,
            'total' => collect($sources)->sum('count'),
            'sources' => $items,
            'leadBreakdown' => [
                'pending' => $leads->where('status', 'new')->count(),
                'submitted' => $leads->where('status', 'submitted')->count(),
            ],
        ];
    }

    public function companyReportHiringTime(string $companyId): array
    {
        $applications = collect($this->bootstrap()['applications'] ?? [])
            ->where('companyId', $companyId)
            ->values();

        $durations = $applications
            ->map(function (array $application): ?int {
                $submittedAt = $application['submittedAt'] ?? null;
                $completedAt = $application['analysis']['completedAt'] ?? null;

                if (! $submittedAt || ! $completedAt) {
                    return null;
                }

                return Carbon::parse((string) $submittedAt)->diffInDays(Carbon::parse((string) $completedAt));
            })
            ->filter(fn ($duration): bool => is_int($duration))
            ->values();

        return [
            'companyId' => $companyId,
            'sampleSize' => $durations->count(),
            'averageDays' => $durations->isEmpty() ? 0 : round($durations->avg(), 2),
            'minDays' => $durations->isEmpty() ? 0 : $durations->min(),
            'maxDays' => $durations->isEmpty() ? 0 : $durations->max(),
        ];
    }

    public function exportApplicationAnalysis(string $applicationId): array
    {
        $application = collect($this->bootstrap()['applications'] ?? [])->firstWhere('id', $applicationId);

        if (! $application) {
            throw ValidationException::withMessages([
                'applicationId' => 'A candidatura selecionada nao foi encontrada.',
            ]);
        }

        $analysis = $application['analysis'] ?? null;
        $candidate = $application['candidate'] ?? [];
        $job = $application['job'] ?? [];

        $payload = [
            'applicationId' => $applicationId,
            'generatedAt' => now()->toDateTimeString(),
            'candidate' => [
                'id' => $candidate['id'] ?? null,
                'name' => $candidate['name'] ?? null,
                'email' => $candidate['email'] ?? null,
                'location' => $candidate['location'] ?? null,
            ],
            'job' => [
                'id' => $job['id'] ?? null,
                'title' => $job['title'] ?? null,
                'company' => $job['company'] ?? null,
            ],
            'applicationStatus' => $application['status'] ?? null,
            'analysis' => $analysis,
            'summary' => [
                'compatibilityScore' => $analysis['compatibilityScore'] ?? null,
                'overallScore' => $analysis['aiAnalysis']['overallScore'] ?? null,
                'consistencyScore' => $analysis['consistencyScore'] ?? $analysis['aiAnalysis']['consistencyScore'] ?? null,
                'primaryDiscType' => $analysis['discProfile']['primaryType'] ?? null,
                'lifePathNumber' => $analysis['numerology']['lifePathNumber'] ?? null,
            ],
        ];

        if ((bool) config('analysis.report_markdown_enabled', true)) {
            $payload['reportMarkdown'] = $this->buildAnalysisReportMarkdown($payload);
        }

        return $payload;
    }

    private function appendSubmissionToState(array $state, array $input): array
    {
        $jobs = collect($state['jobs'] ?? []);
        $job = $jobs->firstWhere('id', $input['jobId']);

        if (! $job) {
            throw ValidationException::withMessages([
                'jobId' => 'A vaga selecionada nao foi encontrada.',
            ]);
        }

        $now = Carbon::now();
        $skills = $this->normalizeSkills($input['skills']);
        $resumeFileName = $input['resumeFileName'] ?? null;
        $resumeUrl = $input['resumeUrl'] ?? null;
        $candidateId = $this->nextId($state['candidates'] ?? []);
        $analysisId = $this->nextId($state['analyses'] ?? []);
        $applicationId = $this->nextId($state['applications'] ?? []);

        $candidate = [
            'id' => $candidateId,
            'name' => $input['name'],
            'email' => $input['email'],
            'phone' => $input['phone'],
            'linkedinUrl' => ($input['linkedinUrl'] ?? null) ?: null,
            'resumeUrl' => $resumeUrl ?: null,
            'resumeFileName' => $resumeFileName ?: null,
            'location' => $input['location'],
            'experience' => $this->normalizeExperience($input['experienceRange']),
            'education' => $input['education'],
            'skills' => $skills,
            'currentPosition' => null,
            'currentCompany' => null,
            'status' => 'available',
            'submittedBy' => [
                'type' => 'empresa',
                'companyId' => $job['companyId'],
                'companyName' => $job['company'],
            ],
            'createdAt' => $now->toDateString(),
        ];

        $analysis = [
            'id' => $analysisId,
            'candidateId' => $candidateId,
            'jobId' => $job['id'],
            'aiAnalysis' => [
                'overallScore' => 0,
                'technicalSkills' => 0,
                'softSkills' => 0,
                'experienceRelevance' => 0,
                'educationMatch' => 0,
                'cultureFit' => 0,
                'summary' => '',
                'strengths' => [],
                'weaknesses' => [],
                'recommendations' => [],
            ],
            'discProfile' => [
                'dominance' => 0,
                'influence' => 0,
                'steadiness' => 0,
                'conscientiousness' => 0,
                'primaryType' => 'D',
                'description' => '',
            ],
            'numerology' => [
                'lifePathNumber' => 0,
                'expressionNumber' => 0,
                'soulUrgeNumber' => 0,
                'personalityNumber' => 0,
                'interpretation' => '',
            ],
            'status' => 'pending',
            'createdAt' => $now->toDateString(),
        ];

        $updatedJobs = $jobs
            ->map(function (array $existingJob) use ($job): array {
                if ($existingJob['id'] !== $job['id']) {
                    return $existingJob;
                }

                $existingJob['applicationsCount'] = ((int) ($existingJob['applicationsCount'] ?? 0)) + 1;

                return $existingJob;
            })
            ->values()
            ->all();

        $applicationJob = collect($updatedJobs)->firstWhere('id', $job['id']) ?? $job;

        $application = [
            'id' => $applicationId,
            'candidateId' => $candidateId,
            'candidate' => $candidate,
            'jobId' => $job['id'],
            'job' => $applicationJob,
            'companyId' => $job['companyId'],
            'analysis' => $analysis,
            'status' => 'submitted',
            'submittedAt' => $now->toDateString(),
            'notes' => ($input['notes'] ?? null) ?: null,
        ];

        $state['jobs'] = $updatedJobs;
        $state['candidates'] = [...($state['candidates'] ?? []), $candidate];
        $state['analyses'] = [...($state['analyses'] ?? []), $analysis];
        $state['applications'] = [...($state['applications'] ?? []), $application];

        return [
            'state' => $state,
            'candidate' => $candidate,
            'application' => $application,
        ];
    }

    private function decorate(array $state): array
    {
        return [
            ...$state,
            'tokenActions' => $this->tokenActionsCatalog($state),
            'dashboardStats' => $this->dashboardStats($state),
        ];
    }

    private function dashboardStats(array $state): array
    {
        $analyses = collect($state['analyses'] ?? []);
        $compatibilityScores = $analyses
            ->pluck('compatibilityScore')
            ->filter(fn ($score): bool => is_numeric($score))
            ->map(fn ($score): float => (float) $score)
            ->values();

        $averageCompatibility = $compatibilityScores->isEmpty()
            ? 0
            : round($compatibilityScores->avg(), 2);

        return [
            'totalCandidates' => count($state['candidates'] ?? []),
            'totalJobs' => count($state['jobs'] ?? []),
            'totalApplications' => count($state['applications'] ?? []),
            'pendingAnalyses' => $analyses->where('status', 'pending')->count(),
            'completedAnalyses' => $analyses->where('status', 'completed')->count(),
            'averageCompatibility' => $averageCompatibility,
        ];
    }

    private function state(): array
    {
        $record = DemoState::query()->firstOrCreate(
            ['key' => self::STATE_KEY],
            ['payload' => $this->seedPayload()],
        );

        $normalized = $this->normalizeState($record->payload ?? $this->seedPayload());
        $synchronized = $this->synchronizeUsersWithAccounts($normalized);
        $synchronized = $this->ensureCandidateProfilesForAccounts($synchronized);

        if ($synchronized !== $normalized) {
            $record->payload = $synchronized;
            $record->save();
        }

        return $synchronized;
    }

    private function store(array $payload): void
    {
        DemoState::query()->updateOrCreate(
            ['key' => self::STATE_KEY],
            ['payload' => $this->normalizeState($payload)],
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function seedPayload(): array
    {
        if (app()->environment('testing')) {
            return $this->normalizeState($this->testingPayload());
        }

        try {
            /** @var array<string, mixed> $payload */
            $payload = json_decode(
                file_get_contents(database_path('seeders/data/demo-data.json')) ?: '{}',
                true,
                512,
                JSON_THROW_ON_ERROR,
            );

            return $this->normalizeState($payload);
        } catch (JsonException) {
            return $this->fallbackPayload();
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function fallbackPayload(): array
    {
        return [
            'users' => [],
            'jobs' => [],
            'candidates' => [],
            'analyses' => [],
            'applications' => [],
            'leads' => [],
            'settings' => [
                'admin' => [],
                'empresa' => [],
                'candidato' => [],
            ],
            'notificationReads' => [],
            'candidateSavedJobs' => [],
            'tokenPricing' => self::TOKEN_PRICING_DEFAULTS,
            'tokenWallets' => [],
            'tokenTransactions' => [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function testingPayload(): array
    {
        return [
            'users' => [
                [
                    'id' => '1',
                    'name' => 'Admin Perfiliza',
                    'email' => 'admin@perfiliza.test',
                    'role' => 'admin',
                ],
                [
                    'id' => '2',
                    'name' => 'Empresa Perfiliza',
                    'email' => 'empresa@perfiliza.test',
                    'role' => 'empresa',
                    'company' => 'Perfiliza Labs',
                ],
                [
                    'id' => '3',
                    'name' => 'Candidato Perfiliza',
                    'email' => 'candidato@perfiliza.test',
                    'role' => 'candidato',
                ],
            ],
            'jobs' => [
                [
                    'id' => '1',
                    'title' => 'Desenvolvedor Full Stack',
                    'company' => 'Perfiliza Labs',
                    'companyId' => '2',
                    'department' => 'Engenharia',
                    'location' => 'Remoto',
                    'type' => 'CLT',
                    'level' => 'Pleno',
                    'description' => 'Construcao e evolucao de produto web.',
                    'requirements' => ['React', 'TypeScript'],
                    'benefits' => ['Plano de saude'],
                    'status' => 'active',
                    'createdAt' => '2026-01-10',
                    'applicationsCount' => 2,
                ],
            ],
            'candidates' => [
                [
                    'id' => '1',
                    'name' => 'Ana Candidata',
                    'email' => 'ana@perfiliza.test',
                    'phone' => '(11) 90000-0001',
                    'location' => 'Sao Paulo, SP',
                    'experience' => 5,
                    'education' => 'Ciencia da Computacao',
                    'skills' => ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS'],
                    'status' => 'open_to_offers',
                    'submittedBy' => [
                        'type' => 'empresa',
                        'companyId' => '2',
                        'companyName' => 'Perfiliza Labs',
                    ],
                    'createdAt' => '2026-01-12',
                ],
                [
                    'id' => '3',
                    'name' => 'Candidato Perfiliza',
                    'email' => 'candidato@perfiliza.test',
                    'phone' => '(11) 90000-0003',
                    'location' => 'Campinas, SP',
                    'experience' => 2,
                    'education' => 'Sistemas de Informacao',
                    'skills' => ['Python', 'SQL'],
                    'status' => 'available',
                    'submittedBy' => [
                        'type' => 'candidato',
                    ],
                    'createdAt' => '2026-01-14',
                ],
            ],
            'analyses' => [
                [
                    'id' => '1',
                    'candidateId' => '1',
                    'jobId' => '1',
                    'aiAnalysis' => [
                        'overallScore' => 0,
                        'technicalSkills' => 0,
                        'softSkills' => 0,
                        'experienceRelevance' => 0,
                        'educationMatch' => 0,
                        'cultureFit' => 0,
                        'summary' => '',
                        'strengths' => [],
                        'weaknesses' => [],
                        'recommendations' => [],
                    ],
                    'discProfile' => [
                        'dominance' => 0,
                        'influence' => 0,
                        'steadiness' => 0,
                        'conscientiousness' => 0,
                        'primaryType' => 'D',
                        'description' => '',
                    ],
                    'numerology' => [
                        'lifePathNumber' => 0,
                        'expressionNumber' => 0,
                        'soulUrgeNumber' => 0,
                        'personalityNumber' => 0,
                        'interpretation' => '',
                    ],
                    'status' => 'pending',
                    'createdAt' => '2026-01-12',
                ],
                [
                    'id' => '3',
                    'candidateId' => '3',
                    'jobId' => '1',
                    'aiAnalysis' => [
                        'overallScore' => 0,
                        'technicalSkills' => 0,
                        'softSkills' => 0,
                        'experienceRelevance' => 0,
                        'educationMatch' => 0,
                        'cultureFit' => 0,
                        'summary' => '',
                        'strengths' => [],
                        'weaknesses' => [],
                        'recommendations' => [],
                    ],
                    'discProfile' => [
                        'dominance' => 0,
                        'influence' => 0,
                        'steadiness' => 0,
                        'conscientiousness' => 0,
                        'primaryType' => 'D',
                        'description' => '',
                    ],
                    'numerology' => [
                        'lifePathNumber' => 0,
                        'expressionNumber' => 0,
                        'soulUrgeNumber' => 0,
                        'personalityNumber' => 0,
                        'interpretation' => '',
                    ],
                    'status' => 'pending',
                    'createdAt' => '2026-01-14',
                ],
            ],
            'applications' => [
                [
                    'id' => '1',
                    'candidateId' => '1',
                    'candidate' => [
                        'id' => '1',
                        'name' => 'Ana Candidata',
                        'email' => 'ana@perfiliza.test',
                        'phone' => '(11) 90000-0001',
                        'location' => 'Sao Paulo, SP',
                        'experience' => 5,
                        'education' => 'Ciencia da Computacao',
                        'skills' => ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS'],
                        'status' => 'open_to_offers',
                        'submittedBy' => [
                            'type' => 'empresa',
                            'companyId' => '2',
                            'companyName' => 'Perfiliza Labs',
                        ],
                        'createdAt' => '2026-01-12',
                    ],
                    'jobId' => '1',
                    'job' => [
                        'id' => '1',
                        'title' => 'Desenvolvedor Full Stack',
                        'company' => 'Perfiliza Labs',
                        'companyId' => '2',
                        'department' => 'Engenharia',
                        'location' => 'Remoto',
                        'type' => 'CLT',
                        'level' => 'Pleno',
                        'description' => 'Construcao e evolucao de produto web.',
                        'requirements' => ['React', 'TypeScript'],
                        'benefits' => ['Plano de saude'],
                        'status' => 'active',
                        'createdAt' => '2026-01-10',
                        'applicationsCount' => 2,
                    ],
                    'companyId' => '2',
                    'analysis' => [
                        'id' => '1',
                        'candidateId' => '1',
                        'jobId' => '1',
                        'aiAnalysis' => [
                            'overallScore' => 0,
                            'technicalSkills' => 0,
                            'softSkills' => 0,
                            'experienceRelevance' => 0,
                            'educationMatch' => 0,
                            'cultureFit' => 0,
                            'summary' => '',
                            'strengths' => [],
                            'weaknesses' => [],
                            'recommendations' => [],
                        ],
                        'discProfile' => [
                            'dominance' => 0,
                            'influence' => 0,
                            'steadiness' => 0,
                            'conscientiousness' => 0,
                            'primaryType' => 'D',
                            'description' => '',
                        ],
                        'numerology' => [
                            'lifePathNumber' => 0,
                            'expressionNumber' => 0,
                            'soulUrgeNumber' => 0,
                            'personalityNumber' => 0,
                            'interpretation' => '',
                        ],
                        'status' => 'pending',
                        'createdAt' => '2026-01-12',
                    ],
                    'status' => 'submitted',
                    'submittedAt' => '2026-01-12',
                    'notes' => null,
                ],
                [
                    'id' => '3',
                    'candidateId' => '3',
                    'candidate' => [
                        'id' => '3',
                        'name' => 'Candidato Perfiliza',
                        'email' => 'candidato@perfiliza.test',
                        'phone' => '(11) 90000-0003',
                        'location' => 'Campinas, SP',
                        'experience' => 2,
                        'education' => 'Sistemas de Informacao',
                        'skills' => ['Python', 'SQL'],
                        'status' => 'available',
                        'submittedBy' => [
                            'type' => 'candidato',
                        ],
                        'createdAt' => '2026-01-14',
                    ],
                    'jobId' => '1',
                    'job' => [
                        'id' => '1',
                        'title' => 'Desenvolvedor Full Stack',
                        'company' => 'Perfiliza Labs',
                        'companyId' => '2',
                        'department' => 'Engenharia',
                        'location' => 'Remoto',
                        'type' => 'CLT',
                        'level' => 'Pleno',
                        'description' => 'Construcao e evolucao de produto web.',
                        'requirements' => ['React', 'TypeScript'],
                        'benefits' => ['Plano de saude'],
                        'status' => 'active',
                        'createdAt' => '2026-01-10',
                        'applicationsCount' => 2,
                    ],
                    'companyId' => '2',
                    'analysis' => [
                        'id' => '3',
                        'candidateId' => '3',
                        'jobId' => '1',
                        'aiAnalysis' => [
                            'overallScore' => 0,
                            'technicalSkills' => 0,
                            'softSkills' => 0,
                            'experienceRelevance' => 0,
                            'educationMatch' => 0,
                            'cultureFit' => 0,
                            'summary' => '',
                            'strengths' => [],
                            'weaknesses' => [],
                            'recommendations' => [],
                        ],
                        'discProfile' => [
                            'dominance' => 0,
                            'influence' => 0,
                            'steadiness' => 0,
                            'conscientiousness' => 0,
                            'primaryType' => 'D',
                            'description' => '',
                        ],
                        'numerology' => [
                            'lifePathNumber' => 0,
                            'expressionNumber' => 0,
                            'soulUrgeNumber' => 0,
                            'personalityNumber' => 0,
                            'interpretation' => '',
                        ],
                        'status' => 'pending',
                        'createdAt' => '2026-01-14',
                    ],
                    'status' => 'submitted',
                    'submittedAt' => '2026-01-14',
                    'notes' => null,
                ],
            ],
            'leads' => [],
            'settings' => [
                'admin' => [],
                'empresa' => [],
                'candidato' => [],
            ],
            'notificationReads' => [],
            'candidateSavedJobs' => [],
            'tokenPricing' => self::TOKEN_PRICING_DEFAULTS,
            'tokenWallets' => [
                [
                    'companyId' => '2',
                    'companyName' => 'Perfiliza Labs',
                    'balance' => 120,
                    'purchased' => 120,
                    'spent' => 0,
                    'createdAt' => '2026-01-10 00:00:00',
                    'updatedAt' => '2026-01-10 00:00:00',
                ],
            ],
            'tokenTransactions' => [],
        ];
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  \Illuminate\Support\Collection<int, User>|null  $accounts
     * @return array<string, mixed>
     */
    private function synchronizeUsersWithAccounts(array $state, ?\Illuminate\Support\Collection $accounts = null): array
    {
        $accounts ??= User::query()
            ->select(['id', 'name', 'email', 'role', 'company'])
            ->whereIn('role', ['admin', 'empresa', 'candidato'])
            ->orderBy('id')
            ->get();

        if ($accounts->isEmpty()) {
            return $state;
        }

        $existingUsersById = collect($state['users'] ?? [])
            ->filter(fn ($user): bool => is_array($user))
            ->keyBy(fn (array $user): string => (string) ($user['id'] ?? ''));

        $state['users'] = $accounts
            ->map(function (User $account) use ($existingUsersById): array {
                $id = (string) $account->id;
                $existing = (array) ($existingUsersById->get($id) ?? []);

                $user = [
                    ...$existing,
                    'id' => $id,
                    'name' => (string) $account->name,
                    'email' => (string) $account->email,
                    'role' => (string) $account->role,
                ];

                if ((string) $account->role === 'empresa') {
                    $user['company'] = $account->company ? (string) $account->company : (string) $account->name;
                } else {
                    unset($user['company']);
                }

                return $user;
            })
            ->values()
            ->all();

        return $state;
    }

    /**
     * @param  array<string, mixed>  $state
     * @return array<string, mixed>
     */
    private function ensureCandidateProfilesForAccounts(array $state): array
    {
        $candidateUsers = collect($state['users'] ?? [])
            ->filter(fn (array $user): bool => ($user['role'] ?? null) === 'candidato')
            ->values();

        if ($candidateUsers->isEmpty()) {
            return $state;
        }

        $candidatesById = collect($state['candidates'] ?? [])
            ->filter(fn ($candidate): bool => is_array($candidate))
            ->keyBy(fn (array $candidate): string => (string) ($candidate['id'] ?? ''));

        foreach ($candidateUsers as $candidateUser) {
            $candidateId = (string) ($candidateUser['id'] ?? '');
            if ($candidateId === '') {
                continue;
            }

            $existingCandidate = (array) ($candidatesById->get($candidateId) ?? []);
            $createdAt = is_string($existingCandidate['createdAt'] ?? null) && trim((string) $existingCandidate['createdAt']) !== ''
                ? (string) $existingCandidate['createdAt']
                : now()->toDateString();

            $candidate = [
                ...$existingCandidate,
                'id' => $candidateId,
                'name' => (string) ($candidateUser['name'] ?? $existingCandidate['name'] ?? 'Candidato'),
                'email' => (string) ($candidateUser['email'] ?? $existingCandidate['email'] ?? ''),
                'phone' => (string) ($existingCandidate['phone'] ?? ''),
                'location' => (string) ($existingCandidate['location'] ?? ''),
                'experience' => (int) ($existingCandidate['experience'] ?? 0),
                'education' => (string) ($existingCandidate['education'] ?? ''),
                'skills' => $this->normalizeSkills($existingCandidate['skills'] ?? []),
                'status' => (string) ($existingCandidate['status'] ?? 'available'),
                'submittedBy' => is_array($existingCandidate['submittedBy'] ?? null)
                    ? $existingCandidate['submittedBy']
                    : ['type' => 'candidato'],
                'createdAt' => $createdAt,
            ];

            $candidatesById->put($candidateId, $candidate);
            $state['candidateSavedJobs'][$candidateId] ??= [];
        }

        $state['candidates'] = $candidatesById->values()->all();

        return $state;
    }

    /**
     * @param  array<string, mixed>  $state
     * @return array<string, mixed>
     */
    private function normalizeState(array $state): array
    {
        $state['users'] ??= [];
        $state['jobs'] ??= [];
        $state['candidates'] ??= [];
        $state['analyses'] ??= [];
        $state['applications'] ??= [];
        $state['leads'] ??= [];
        $state['settings'] ??= [
            'admin' => [],
            'empresa' => [],
            'candidato' => [],
        ];
        $state['notificationReads'] ??= [];
        $state['candidateSavedJobs'] ??= [];
        $state['tokenPricing'] = $this->normalizeTokenPricing(
            is_array($state['tokenPricing'] ?? null) ? $state['tokenPricing'] : []
        );
        $state['tokenWallets'] = is_array($state['tokenWallets'] ?? null) ? $state['tokenWallets'] : [];
        $state['tokenTransactions'] = is_array($state['tokenTransactions'] ?? null) ? $state['tokenTransactions'] : [];

        $normalizedLeads = collect($state['leads'])
            ->map(function (array $lead): array {
                return [
                    ...$lead,
                    'skills' => $this->normalizeSkills($lead['skills'] ?? []),
                    'discAnswers' => $this->normalizeDiscAnswers($lead['discAnswers'] ?? []),
                    'customAnswers' => $this->normalizeCustomAnswers($lead['customAnswers'] ?? []),
                    'resumeUrl' => $lead['resumeUrl'] ?? null,
                    'status' => $lead['status'] ?? 'new',
                    'applicationId' => $lead['applicationId'] ?? null,
                ];
            })
            ->values()
            ->all();

        $leadCounts = collect($normalizedLeads)
            ->groupBy('jobId')
            ->map(fn ($jobLeads): int => $jobLeads->count());

        $normalizedJobs = collect($state['jobs'])
            ->map(function (array $job) use ($leadCounts): array {
                $job['shareToken'] = $job['shareToken'] ?? $this->shareTokenForJob($job);
                $job['customQuestions'] = $this->normalizeQuestions(
                    $job['customQuestions'] ?? $this->defaultQuestionsForJob($job)
                );
                $job['scoreWeights'] = $this->normalizeScoreWeights(
                    is_array($job['scoreWeights'] ?? null) ? $job['scoreWeights'] : []
                );
                $job['leadCount'] = $leadCounts->get($job['id'], 0);

                return $job;
            })
            ->values()
            ->all();

        $companyIds = collect($state['users'] ?? [])
            ->filter(fn (array $user): bool => ($user['role'] ?? null) === 'empresa')
            ->pluck('id')
            ->merge(collect($state['jobs'] ?? [])->pluck('companyId'))
            ->merge(collect($state['applications'] ?? [])->pluck('companyId'))
            ->merge(collect($normalizedLeads)->pluck('companyId'))
            ->merge(collect($state['tokenWallets'])->pluck('companyId'))
            ->filter(function ($companyId): bool {
                return is_scalar($companyId) && trim((string) $companyId) !== '';
            })
            ->map(fn ($companyId): string => trim((string) $companyId))
            ->unique()
            ->values();

        $walletsByCompany = collect($state['tokenWallets'])
            ->filter(fn ($wallet): bool => is_array($wallet))
            ->keyBy(fn (array $wallet): string => trim((string) ($wallet['companyId'] ?? '')));

        $normalizedTokenWallets = $companyIds
            ->map(function (string $companyId) use ($walletsByCompany, $state): array {
                $wallet = (array) ($walletsByCompany->get($companyId) ?? []);
                $balance = max(0, (int) ($wallet['balance'] ?? self::DEFAULT_COMPANY_TOKEN_BALANCE));
                $spent = max(0, (int) ($wallet['spent'] ?? 0));
                $purchased = max(
                    $balance + $spent,
                    (int) ($wallet['purchased'] ?? ($balance + $spent))
                );
                $createdAt = is_string($wallet['createdAt'] ?? null) && trim((string) $wallet['createdAt']) !== ''
                    ? (string) $wallet['createdAt']
                    : now()->toDateTimeString();
                $updatedAt = is_string($wallet['updatedAt'] ?? null) && trim((string) $wallet['updatedAt']) !== ''
                    ? (string) $wallet['updatedAt']
                    : $createdAt;

                return [
                    'companyId' => $companyId,
                    'companyName' => $this->companyNameFromState($state, $companyId),
                    'balance' => $balance,
                    'purchased' => $purchased,
                    'spent' => $spent,
                    'createdAt' => $createdAt,
                    'updatedAt' => $updatedAt,
                ];
            })
            ->sortBy('companyId')
            ->values()
            ->all();

        $normalizedTokenTransactions = collect($state['tokenTransactions'])
            ->filter(fn ($transaction): bool => is_array($transaction))
            ->map(function (array $transaction, int $index): array {
                $companyId = trim((string) ($transaction['companyId'] ?? ''));
                $tokens = (int) ($transaction['tokens'] ?? 0);

                if ($companyId === '' || $tokens === 0) {
                    return [];
                }

                $action = is_string($transaction['action'] ?? null)
                    ? (string) $transaction['action']
                    : 'manual_adjustment';
                $description = is_string($transaction['description'] ?? null) && trim((string) $transaction['description']) !== ''
                    ? (string) $transaction['description']
                    : ($this->tokenActionLabel($action) ?? 'Ajuste manual de tokens.');

                return [
                    'id' => is_numeric($transaction['id'] ?? null)
                        ? (string) $transaction['id']
                        : (string) ($index + 1),
                    'companyId' => $companyId,
                    'direction' => $tokens > 0 ? 'credit' : 'debit',
                    'action' => $action,
                    'description' => $description,
                    'tokens' => $tokens,
                    'balanceAfter' => max(0, (int) ($transaction['balanceAfter'] ?? 0)),
                    'metadata' => is_array($transaction['metadata'] ?? null) ? $transaction['metadata'] : [],
                    'createdAt' => is_string($transaction['createdAt'] ?? null) && trim((string) $transaction['createdAt']) !== ''
                        ? (string) $transaction['createdAt']
                        : now()->toDateTimeString(),
                ];
            })
            ->filter(fn (array $transaction): bool => $transaction !== [])
            ->sortByDesc('createdAt')
            ->values()
            ->take(400)
            ->all();

        return [
            ...$state,
            'jobs' => $normalizedJobs,
            'leads' => $normalizedLeads,
            'tokenPricing' => $state['tokenPricing'],
            'tokenWallets' => $normalizedTokenWallets,
            'tokenTransactions' => $normalizedTokenTransactions,
            'settings' => [
                'admin' => is_array($state['settings']['admin'] ?? null) ? $state['settings']['admin'] : [],
                'empresa' => is_array($state['settings']['empresa'] ?? null) ? $state['settings']['empresa'] : [],
                'candidato' => is_array($state['settings']['candidato'] ?? null) ? $state['settings']['candidato'] : [],
            ],
            'notificationReads' => collect($state['notificationReads'] ?? [])
                ->map(function ($ids): array {
                    return collect(is_array($ids) ? $ids : [])
                        ->filter(fn ($id): bool => is_string($id) && $id !== '')
                        ->unique()
                        ->values()
                        ->all();
                })
                ->all(),
            'candidateSavedJobs' => collect($state['candidateSavedJobs'] ?? [])
                ->map(function ($jobIds) use ($normalizedJobs): array {
                    $validJobIds = collect($normalizedJobs)
                        ->map(fn (array $job): string => (string) ($job['id'] ?? ''))
                        ->filter()
                        ->values();

                    return collect(is_array($jobIds) ? $jobIds : [])
                        ->filter(fn ($jobId): bool => is_string($jobId) && trim($jobId) !== '')
                        ->map(fn (string $jobId): string => trim($jobId))
                        ->filter(fn (string $jobId): bool => $validJobIds->contains($jobId))
                        ->unique()
                        ->values()
                        ->all();
                })
                ->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $application
     * @param  array<string, mixed>  $candidate
     * @return array<string, mixed>
     */
    private function buildCompletedAnalysis(
        string $analysisId,
        array $application,
        array $candidate,
        string $createdAt,
        ?array $pipelineContext = null,
    ): array {
        $now = Carbon::now()->toDateString();
        $skills = collect($candidate['skills'] ?? [])
            ->map(fn ($skill): string => Str::lower((string) $skill))
            ->values();
        $experience = (int) ($candidate['experience'] ?? 0);
        $education = Str::lower((string) ($candidate['education'] ?? ''));
        $hasLinkedIn = ! empty($candidate['linkedinUrl'] ?? null);
        $resumeParse = is_array($pipelineContext['resumeParse'] ?? null) ? $pipelineContext['resumeParse'] : [];
        $llmInsights = is_array($pipelineContext['llmInsights'] ?? null) ? $pipelineContext['llmInsights'] : [];
        $llmPayload = is_array($llmInsights['payload'] ?? null) ? $llmInsights['payload'] : [];
        $llmScoringHints = is_array($llmPayload['scoringHints'] ?? null) ? $llmPayload['scoringHints'] : [];
        $llmIdentitySignals = is_array($llmPayload['identitySignals'] ?? null) ? $llmPayload['identitySignals'] : [];
        $sourceType = (string) ($pipelineContext['sourceType'] ?? $candidate['submittedBy']['type'] ?? 'empresa');
        $applyLlmScoreHints = (bool) config('analysis.ai_apply_score_hints', false);
        $detectedSkillsCount = collect($resumeParse['detectedSkills'] ?? [])
            ->map(fn ($skill): string => trim((string) $skill))
            ->filter()
            ->count();
        $parsedLinkedinUrls = collect($resumeParse['extractedLinkedinUrls'] ?? [])
            ->map(fn ($url): string => $this->normalizeComparableUrl((string) $url))
            ->filter()
            ->values();
        $experienceHintsCount = max(0, (int) ($resumeParse['experienceHintsCount'] ?? 0));
        $educationHintsCount = max(0, (int) ($resumeParse['educationHintsCount'] ?? 0));
        $sectionsDetectedCount = count(
            collect($resumeParse['sectionsDetected'] ?? [])
                ->map(fn ($section): string => trim((string) $section))
                ->filter()
                ->all()
        );
        $parseConfidence = is_array($resumeParse['confidence'] ?? null) ? $resumeParse['confidence'] : [];
        $parseTextConfidence = max(0, min(1, (float) ($parseConfidence['textExtraction'] ?? 0)));
        $candidateLinkedinUrl = $this->normalizeComparableUrl((string) ($candidate['linkedinUrl'] ?? ''));
        $hasParsedLinkedin = $parsedLinkedinUrls->isNotEmpty();
        $hasLinkedinMatch = $candidateLinkedinUrl !== ''
            && $parsedLinkedinUrls->contains(function (string $parsedUrl) use ($candidateLinkedinUrl): bool {
                return $parsedUrl === $candidateLinkedinUrl
                    || str_contains($parsedUrl, $candidateLinkedinUrl)
                    || str_contains($candidateLinkedinUrl, $parsedUrl);
            });
        $scoreWeights = $this->normalizeScoreWeights(
            is_array($application['job']['scoreWeights'] ?? null) ? $application['job']['scoreWeights'] : []
        );

        $technicalSkills = min(98, 45 + ($skills->count() * 7) + ($experience * 2));
        $softSkills = min(96, 56 + ($experience * 4) + ($hasLinkedIn ? 8 : 0));
        $experienceRelevance = min(98, 40 + ($experience * 9));
        $educationMatch = Str::contains($education, ['comput', 'engenh', 'dados', 'design']) ? 88 : 74;
        $cultureFit = min(96, 58 + (int) round($softSkills / 4));
        $baseTechnicalSkills = $technicalSkills;
        $baseExperienceRelevance = $experienceRelevance;
        $baseEducationMatch = $educationMatch;
        $baseCultureFit = $cultureFit;
        $requestedTechnicalBoost = 0;
        $requestedExperienceBoost = 0;
        $requestedEducationBoost = 0;
        $requestedCultureBoost = 0;
        $adjustmentReasons = [];

        if ($detectedSkillsCount > 0) {
            $requestedTechnicalBoost = min(6, (int) round($detectedSkillsCount * 1.2));
            $technicalSkills = min(98, $technicalSkills + $requestedTechnicalBoost);
            $adjustmentReasons[] = 'Skills adicionais detectadas no curriculo.';
        }

        if ($experienceHintsCount > 0) {
            $requestedExperienceBoost = min(8, 3 + $experienceHintsCount);
            $experienceRelevance = min(98, $experienceRelevance + $requestedExperienceBoost);
            $adjustmentReasons[] = 'Evidencias de experiencia extraidas do curriculo.';
        }

        if ($educationHintsCount > 0) {
            $requestedEducationBoost = min(8, 4 + $educationHintsCount);
            $educationMatch = min(96, $educationMatch + $requestedEducationBoost);
            $adjustmentReasons[] = 'Sinais de formacao academica identificados.';
        }

        if ($sectionsDetectedCount >= 3 || $parseTextConfidence >= 0.8) {
            $requestedCultureBoost = 2;
            $cultureFit = min(96, $cultureFit + $requestedCultureBoost);
            $adjustmentReasons[] = 'Curriculo com boa estrutura e confianca de extracao.';
        }

        $llmTechnicalBoost = max(-5, min(5, (int) ($llmScoringHints['technicalBoost'] ?? 0)));
        $llmExperienceBoost = max(-5, min(5, (int) ($llmScoringHints['experienceBoost'] ?? 0)));
        $llmEducationBoost = max(-5, min(5, (int) ($llmScoringHints['educationBoost'] ?? 0)));
        $llmCultureBoost = max(-5, min(5, (int) ($llmScoringHints['cultureBoost'] ?? 0)));

        if ($applyLlmScoreHints) {
            $technicalSkills = max(35, min(98, $technicalSkills + $llmTechnicalBoost));
            $experienceRelevance = max(35, min(98, $experienceRelevance + $llmExperienceBoost));
            $educationMatch = max(35, min(96, $educationMatch + $llmEducationBoost));
            $cultureFit = max(35, min(96, $cultureFit + $llmCultureBoost));
        }

        if ($llmTechnicalBoost !== 0 || $llmExperienceBoost !== 0 || $llmEducationBoost !== 0 || $llmCultureBoost !== 0) {
            $adjustmentReasons[] = $applyLlmScoreHints
                ? 'Sugestoes de score da IA aplicadas no calculo final.'
                : 'Sugestoes de score da IA registradas para revisao humana.';
        }

        $consistencyScore = 68;

        if ($hasLinkedIn) {
            $consistencyScore += 10;
        }

        if ($hasParsedLinkedin) {
            $consistencyScore += 4;
        }

        if ($hasLinkedinMatch) {
            $consistencyScore += 8;
        } elseif ($candidateLinkedinUrl !== '' && $hasParsedLinkedin) {
            $consistencyScore -= 12;
        }

        if ($detectedSkillsCount > 0) {
            $consistencyScore += min(8, $detectedSkillsCount * 2);
        }

        if ($experienceHintsCount > 0) {
            $consistencyScore += min(6, 2 + $experienceHintsCount);
        }

        if ($educationHintsCount > 0) {
            $consistencyScore += 3;
        }

        if ($sourceType === 'candidato' && ! $hasLinkedIn) {
            $consistencyScore -= 6;
        } elseif ($sourceType === 'empresa' && ! $hasLinkedIn) {
            $consistencyScore -= 2;
        }

        $computedLinkedinConflict = $candidateLinkedinUrl !== '' && $hasParsedLinkedin && ! $hasLinkedinMatch;
        $llmLinkedinConflict = array_key_exists('linkedinConflict', $llmIdentitySignals)
            ? (bool) $llmIdentitySignals['linkedinConflict']
            : null;
        $linkedinConflict = $llmLinkedinConflict ?? $computedLinkedinConflict;
        $divergenceReason = isset($llmIdentitySignals['divergenceReason'])
            ? trim((string) $llmIdentitySignals['divergenceReason'])
            : '';

        if ($llmLinkedinConflict === true) {
            $consistencyScore -= 8;
        }

        $consistencyScore = max(35, min(98, $consistencyScore));

        $normalizedBaseWeights = $this->normalizeScoreWeights([
            'technicalSkills' => $scoreWeights['technicalSkills'] ?? self::DEFAULT_SCORE_WEIGHTS['technicalSkills'],
            'softSkills' => $scoreWeights['softSkills'] ?? self::DEFAULT_SCORE_WEIGHTS['softSkills'],
            'experienceRelevance' => $scoreWeights['experienceRelevance'] ?? self::DEFAULT_SCORE_WEIGHTS['experienceRelevance'],
            'educationMatch' => $scoreWeights['educationMatch'] ?? self::DEFAULT_SCORE_WEIGHTS['educationMatch'],
            'cultureFit' => $scoreWeights['cultureFit'] ?? self::DEFAULT_SCORE_WEIGHTS['cultureFit'],
            'consistencyScore' => $scoreWeights['consistencyScore'] ?? self::DEFAULT_SCORE_WEIGHTS['consistencyScore'],
        ]);

        $overallWeightsRaw = [
            'technicalSkills' => max(0, (float) ($normalizedBaseWeights['technicalSkills'] ?? 0)),
            'softSkills' => max(0, (float) ($normalizedBaseWeights['softSkills'] ?? 0)),
            'experienceRelevance' => max(0, (float) ($normalizedBaseWeights['experienceRelevance'] ?? 0)),
            'educationMatch' => max(0, (float) ($normalizedBaseWeights['educationMatch'] ?? 0)),
            'cultureFit' => max(0, (float) ($normalizedBaseWeights['cultureFit'] ?? 0)),
        ];
        $overallWeightsSum = max(0.0001, array_sum($overallWeightsRaw));
        $overallWeights = collect($overallWeightsRaw)
            ->map(fn (float $weight): float => $weight / $overallWeightsSum)
            ->all();

        $overallScore = (int) round(
            ($technicalSkills * $overallWeights['technicalSkills'])
            + ($softSkills * $overallWeights['softSkills'])
            + ($experienceRelevance * $overallWeights['experienceRelevance'])
            + ($educationMatch * $overallWeights['educationMatch'])
            + ($cultureFit * $overallWeights['cultureFit'])
        );
        $compatibilityScore = (int) round(
            ($technicalSkills * $normalizedBaseWeights['technicalSkills'])
            + ($softSkills * $normalizedBaseWeights['softSkills'])
            + ($experienceRelevance * $normalizedBaseWeights['experienceRelevance'])
            + ($educationMatch * $normalizedBaseWeights['educationMatch'])
            + ($cultureFit * $normalizedBaseWeights['cultureFit'])
            + ($consistencyScore * $normalizedBaseWeights['consistencyScore'])
        );
        $compatibilityScore = max(45, min(99, $compatibilityScore));

        $disc = [
            'D' => min(95, 32 + ($experience * 7)),
            'I' => min(95, 30 + ($hasLinkedIn ? 22 : 10)),
            'S' => min(95, 44 + (int) round(max(0, 6 - $experience) * 4.5)),
            'C' => min(95, 40 + ($skills->contains(fn (string $skill): bool => str_contains($skill, 'sql')) ? 24 : 14)),
        ];

        arsort($disc);
        $primaryType = (string) array_key_first($disc);
        $secondaryType = (string) (array_keys($disc)[1] ?? $primaryType);
        $topSkills = $skills->take(3)->map(fn (string $skill): string => Str::title($skill))->values()->all();

        $nameLength = strlen((string) preg_replace('/\s+/', '', (string) ($candidate['name'] ?? '')));
        $candidateNumericId = max(1, (int) ($candidate['id'] ?? 1));
        $lifePath = (($candidateNumericId + $nameLength) % 9) ?: 9;
        $expression = (($nameLength + $experience) % 9) ?: 9;
        $soulUrge = (($skills->count() + $candidateNumericId) % 9) ?: 9;
        $personality = (($lifePath + $expression + $soulUrge) % 9) ?: 9;

        $jobTitle = (string) ($application['job']['title'] ?? 'vaga em aberto');
        $candidateName = (string) ($candidate['name'] ?? 'Candidato');
        $hasResumeSignals = $detectedSkillsCount > 0 || $experienceHintsCount > 0 || $educationHintsCount > 0;
        $llmSummary = trim((string) ($llmPayload['summary'] ?? ''));
        $llmStrengths = collect($llmPayload['strengths'] ?? [])
            ->map(fn ($item): string => trim((string) $item))
            ->filter()
            ->values()
            ->all();
        $llmWeaknesses = collect($llmPayload['weaknesses'] ?? [])
            ->map(fn ($item): string => trim((string) $item))
            ->filter()
            ->values()
            ->all();
        $llmRecommendations = collect($llmPayload['recommendations'] ?? [])
            ->map(fn ($item): string => trim((string) $item))
            ->filter()
            ->values()
            ->all();
        $riskFlags = collect($llmPayload['riskFlags'] ?? [])
            ->map(fn ($item): string => trim((string) $item))
            ->filter()
            ->values()
            ->all();
        $llmConfidence = is_numeric($llmPayload['confidence'] ?? null)
            ? max(0, min(1, (float) $llmPayload['confidence']))
            : null;

        return [
            'id' => $analysisId,
            'candidateId' => (string) ($application['candidateId'] ?? $candidate['id']),
            'jobId' => (string) ($application['jobId'] ?? ''),
            'aiAnalysis' => [
                'overallScore' => $overallScore,
                'technicalSkills' => $technicalSkills,
                'softSkills' => $softSkills,
                'experienceRelevance' => $experienceRelevance,
                'educationMatch' => $educationMatch,
                'cultureFit' => $cultureFit,
                'consistencyScore' => $consistencyScore,
                'summary' => $llmSummary !== ''
                    ? $llmSummary
                    : $candidateName.' apresenta aderencia consistente para '.$jobTitle.' com bom equilibrio tecnico e comportamental.'
                        .($hasResumeSignals ? ' Sinais extraidos do curriculo reforcam o score final.' : ''),
                'strengths' => $llmStrengths !== [] ? $llmStrengths : [
                    'Base tecnica alinhada com os requisitos principais da vaga.',
                    'Historico profissional com progressao e entrega continua.',
                    $hasLinkedIn ? 'Presenca profissional validada no LinkedIn.' : 'Perfil com foco tecnico e boa objetividade.',
                    $hasResumeSignals ? 'Curriculo com secoes relevantes e evidencias de aderencia.' : 'Documentacao de perfil dentro do esperado.',
                ],
                'weaknesses' => $llmWeaknesses !== [] ? $llmWeaknesses : [
                    $experience < 3
                        ? 'Experiencia ainda em consolidacao para contextos de alta complexidade.'
                        : 'Pode ampliar profundidade em projetos de escala corporativa.',
                    $skills->count() < 4
                        ? 'Conjunto de skills pode ser expandido para cenarios multidisciplinares.'
                        : 'Pode aprofundar especializacao em stack complementar da vaga.',
                ],
                'recommendations' => $llmRecommendations !== [] ? $llmRecommendations : [
                    'Agendar entrevista tecnica com estudo de caso do time.',
                    'Validar aderencia cultural em etapa de painel com lideranca.',
                    'Aplicar desafio pratico orientado ao contexto real da vaga.',
                ],
                'riskFlags' => $riskFlags,
                'llmConfidence' => $llmConfidence,
                'resumeSignals' => [
                    'detectedSkillsCount' => $detectedSkillsCount,
                    'experienceHintsCount' => $experienceHintsCount,
                    'educationHintsCount' => $educationHintsCount,
                    'sectionsDetectedCount' => $sectionsDetectedCount,
                    'textExtractionConfidence' => $parseTextConfidence,
                    'parsedLinkedinUrlsCount' => $parsedLinkedinUrls->count(),
                    'linkedinMatched' => $hasLinkedinMatch,
                    'sourceType' => $sourceType,
                    'linkedinConflict' => $linkedinConflict,
                ],
                'identityConsistency' => [
                    'sourceType' => $sourceType,
                    'linkedinConflict' => $linkedinConflict,
                    'divergenceReason' => $divergenceReason !== ''
                        ? $divergenceReason
                        : ($linkedinConflict ? 'Possivel divergencia entre LinkedIn informado e curriculo.' : null),
                ],
                'scoreWeights' => $normalizedBaseWeights,
                'scoreAdjustments' => [
                    'technicalSkills' => $technicalSkills - $baseTechnicalSkills,
                    'experienceRelevance' => $experienceRelevance - $baseExperienceRelevance,
                    'educationMatch' => $educationMatch - $baseEducationMatch,
                    'cultureFit' => $cultureFit - $baseCultureFit,
                    'requested' => [
                        'technicalSkills' => $requestedTechnicalBoost,
                        'experienceRelevance' => $requestedExperienceBoost,
                        'educationMatch' => $requestedEducationBoost,
                        'cultureFit' => $requestedCultureBoost,
                        'llm' => [
                            'technicalSkills' => $llmTechnicalBoost,
                            'experienceRelevance' => $llmExperienceBoost,
                            'educationMatch' => $llmEducationBoost,
                            'cultureFit' => $llmCultureBoost,
                            'applied' => $applyLlmScoreHints,
                        ],
                    ],
                    'reasons' => $adjustmentReasons,
                ],
            ],
            'discProfile' => [
                'dominance' => $disc['D'],
                'influence' => $disc['I'],
                'steadiness' => $disc['S'],
                'conscientiousness' => $disc['C'],
                'primaryType' => $primaryType,
                'secondaryType' => $secondaryType,
                'description' => 'Perfil '.$primaryType.' com apoio '.$secondaryType.' indicando boa adaptacao para rotinas de entrega e colaboracao.',
            ],
            'numerology' => [
                'lifePathNumber' => $lifePath,
                'expressionNumber' => $expression,
                'soulUrgeNumber' => $soulUrge,
                'personalityNumber' => $personality,
                'interpretation' => 'Combinacao numerologica com foco em evolucao profissional e consistencia de performance.',
            ],
            'linkedinAnalysis' => $hasLinkedIn
                ? [
                    'profileStrength' => min(98, 62 + ($experience * 4)),
                    'connectionsCount' => $experience >= 5 ? '500+' : ($experience >= 3 ? '200+' : '100+'),
                    'endorsementsCount' => min(90, 18 + ($skills->count() * 6)),
                    'recommendationsCount' => max(2, min(12, $experience + 1)),
                    'activityLevel' => $experience >= 5 ? 'high' : ($experience >= 3 ? 'medium' : 'low'),
                    'topSkills' => $topSkills,
                    'careerProgression' => 'Historico com evolucao consistente de responsabilidades e complexidade.',
                ]
                : null,
            'compatibilityScore' => $compatibilityScore,
            'consistencyScore' => $consistencyScore,
            'scoreWeights' => $normalizedBaseWeights,
            'status' => 'completed',
            'createdAt' => $createdAt,
            'completedAt' => $now,
        ];
    }

    /**
     * @param  array<string, mixed>  $exportPayload
     */
    public function buildAnalysisReportMarkdown(array $exportPayload): string
    {
        $candidate = is_array($exportPayload['candidate'] ?? null) ? $exportPayload['candidate'] : [];
        $job = is_array($exportPayload['job'] ?? null) ? $exportPayload['job'] : [];
        $analysis = is_array($exportPayload['analysis'] ?? null) ? $exportPayload['analysis'] : [];
        $ai = is_array($analysis['aiAnalysis'] ?? null) ? $analysis['aiAnalysis'] : [];
        $resumeSignals = is_array($ai['resumeSignals'] ?? null) ? $ai['resumeSignals'] : [];
        $scoreAdjustments = is_array($ai['scoreAdjustments'] ?? null) ? $ai['scoreAdjustments'] : [];
        $identityConsistency = is_array($ai['identityConsistency'] ?? null) ? $ai['identityConsistency'] : [];

        $lines = [
            '# Relatorio de Analise de Curriculo',
            '',
            '## Resumo Executivo',
            '- Candidato: '.((string) ($candidate['name'] ?? 'Nao informado')),
            '- Vaga: '.((string) ($job['title'] ?? 'Nao informada')),
            '- Empresa: '.((string) ($job['company'] ?? 'Nao informada')),
            '- Compatibilidade: '.((string) ($analysis['compatibilityScore'] ?? 'N/A')),
            '- Consistencia: '.((string) ($analysis['consistencyScore'] ?? 'N/A')),
            '- Gerado em: '.((string) ($exportPayload['generatedAt'] ?? now()->toDateTimeString())),
            '',
            '## Sintese IA',
            (string) ($ai['summary'] ?? 'Sem resumo disponivel.'),
            '',
            '## Pontos Fortes',
        ];

        foreach (collect($ai['strengths'] ?? [])->take(6)->all() as $item) {
            $lines[] = '- '.trim((string) $item);
        }

        $lines[] = '';
        $lines[] = '## Pontos de Atencao';
        foreach (collect($ai['weaknesses'] ?? [])->take(6)->all() as $item) {
            $lines[] = '- '.trim((string) $item);
        }

        $lines[] = '';
        $lines[] = '## Riscos';
        foreach (collect($ai['riskFlags'] ?? ['Sem riscos criticos detectados automaticamente.'])->take(6)->all() as $item) {
            $lines[] = '- '.trim((string) $item);
        }

        $lines[] = '';
        $lines[] = '## Recomendacoes';
        foreach (collect($ai['recommendations'] ?? [])->take(6)->all() as $item) {
            $lines[] = '- '.trim((string) $item);
        }

        $lines[] = '';
        $lines[] = '## Trilha de Score';
        $lines[] = '- Technical Skills: '.((string) ($ai['technicalSkills'] ?? 'N/A'));
        $lines[] = '- Soft Skills: '.((string) ($ai['softSkills'] ?? 'N/A'));
        $lines[] = '- Experience Relevance: '.((string) ($ai['experienceRelevance'] ?? 'N/A'));
        $lines[] = '- Education Match: '.((string) ($ai['educationMatch'] ?? 'N/A'));
        $lines[] = '- Culture Fit: '.((string) ($ai['cultureFit'] ?? 'N/A'));
        $lines[] = '- Overall Score: '.((string) ($ai['overallScore'] ?? 'N/A'));

        $lines[] = '';
        $lines[] = '## Sinais de Curriculo';
        $lines[] = '- Skills detectadas: '.((string) ($resumeSignals['detectedSkillsCount'] ?? 0));
        $lines[] = '- Hints de experiencia: '.((string) ($resumeSignals['experienceHintsCount'] ?? 0));
        $lines[] = '- Hints de educacao: '.((string) ($resumeSignals['educationHintsCount'] ?? 0));
        $lines[] = '- LinkedIn alinhado: '.(((bool) ($resumeSignals['linkedinMatched'] ?? false)) ? 'sim' : 'nao');
        $lines[] = '- Fonte da submissao: '.((string) ($resumeSignals['sourceType'] ?? 'desconhecida'));

        $lines[] = '';
        $lines[] = '## Consistencia de Identidade';
        $lines[] = '- Conflito de LinkedIn: '.(((bool) ($identityConsistency['linkedinConflict'] ?? false)) ? 'sim' : 'nao');
        $lines[] = '- Motivo: '.((string) ($identityConsistency['divergenceReason'] ?? 'sem divergencia'));

        $lines[] = '';
        $lines[] = '## Ajustes de Score';
        $lines[] = '- Technical: '.((string) ($scoreAdjustments['technicalSkills'] ?? 0));
        $lines[] = '- Experience: '.((string) ($scoreAdjustments['experienceRelevance'] ?? 0));
        $lines[] = '- Education: '.((string) ($scoreAdjustments['educationMatch'] ?? 0));
        $lines[] = '- Culture: '.((string) ($scoreAdjustments['cultureFit'] ?? 0));

        foreach (collect($scoreAdjustments['reasons'] ?? [])->take(10)->all() as $reason) {
            $lines[] = '- Motivo: '.trim((string) $reason);
        }

        return implode("\n", $lines)."\n";
    }

    private function normalizeComparableUrl(string $url): string
    {
        $trimmed = trim($url);

        if ($trimmed === '') {
            return '';
        }

        $withoutProtocol = preg_replace('#^https?://#i', '', $trimmed) ?: $trimmed;
        $withoutWww = preg_replace('#^www\.#i', '', $withoutProtocol) ?: $withoutProtocol;
        $withoutQuery = (string) preg_replace('/[\?#].*/', '', $withoutWww);

        return rtrim(Str::lower($withoutQuery), '/');
    }

    /**
     * @param  array<string, mixed>  $job
     */
    private function shareTokenForJob(array $job): string
    {
        $title = is_string($job['title'] ?? null) ? $job['title'] : 'vaga';

        return Str::slug($title).'-'.$job['id'];
    }

    /**
     * @param  array<int, array<string, mixed>>  $questions
     * @return array<int, array<string, mixed>>
     */
    private function normalizeQuestions(array $questions): array
    {
        return collect($questions)
            ->map(function (array $question, int $index): array {
                return [
                    'id' => (string) ($question['id'] ?? 'q'.($index + 1)),
                    'label' => (string) ($question['label'] ?? ''),
                    'type' => in_array($question['type'] ?? 'text', ['text', 'textarea'], true)
                        ? $question['type']
                        : 'text',
                    'required' => (bool) ($question['required'] ?? true),
                    'placeholder' => (string) ($question['placeholder'] ?? ''),
                ];
            })
            ->filter(fn (array $question): bool => $question['label'] !== '')
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $job
     * @return array<int, array<string, mixed>>
     */
    private function defaultQuestionsForJob(array $job): array
    {
        $title = (string) ($job['title'] ?? 'esta vaga');

        return [
            [
                'id' => 'motivation',
                'label' => 'Por que voce quer participar do processo para '.$title.'?',
                'type' => 'textarea',
                'required' => true,
                'placeholder' => 'Conte rapidamente o que te atrai nessa oportunidade.',
            ],
            [
                'id' => 'highlight',
                'label' => 'Qual entrega, projeto ou resultado mais te representa?',
                'type' => 'textarea',
                'required' => true,
                'placeholder' => 'Explique um caso real com contexto, acao e resultado.',
            ],
            [
                'id' => 'availability',
                'label' => 'Qual sua disponibilidade para entrevistas e inicio?',
                'type' => 'text',
                'required' => false,
                'placeholder' => 'Ex: posso iniciar em 30 dias.',
            ],
        ];
    }

    /**
     * @param  array<int, string>|string  $skills
     * @return array<int, string>
     */
    private function normalizeSkills(array|string $skills): array
    {
        if (is_array($skills)) {
            return collect($skills)
                ->map(fn ($skill): string => trim((string) $skill))
                ->filter()
                ->values()
                ->all();
        }

        return collect(explode(',', $skills))
            ->map(fn (string $skill): string => trim($skill))
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @param  array<int, mixed>  $values
     * @return array<int, string>
     */
    private function normalizeStringList(array $values): array
    {
        return collect($values)
            ->map(fn ($value): string => trim((string) $value))
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>|null  $salary
     * @return array<string, int>|null
     */
    private function normalizeSalary(?array $salary): ?array
    {
        if (! is_array($salary)) {
            return null;
        }

        $hasMin = array_key_exists('min', $salary) && is_numeric($salary['min']);
        $hasMax = array_key_exists('max', $salary) && is_numeric($salary['max']);

        if (! $hasMin || ! $hasMax) {
            return null;
        }

        $min = max(0, (int) $salary['min']);
        $max = max($min, (int) $salary['max']);

        return [
            'min' => $min,
            'max' => $max,
        ];
    }

    /**
     * @param  array<string, mixed>  $weights
     * @return array<string, float>
     */
    private function normalizeScoreWeights(array $weights): array
    {
        $merged = [
            ...self::DEFAULT_SCORE_WEIGHTS,
            ...collect($weights)
                ->only(array_keys(self::DEFAULT_SCORE_WEIGHTS))
                ->map(function ($value): float {
                    if (! is_numeric($value)) {
                        return 0.0;
                    }

                    return max(0, (float) $value);
                })
                ->all(),
        ];

        $sum = collect($merged)->sum();

        if ($sum <= 0) {
            return self::DEFAULT_SCORE_WEIGHTS;
        }

        return collect($merged)
            ->map(fn (float $value): float => round($value / $sum, 4))
            ->all();
    }

    /**
     * @param  array<string, mixed>  $pricing
     * @return array<string, int>
     */
    private function normalizeTokenPricing(array $pricing): array
    {
        $normalized = [];

        foreach (self::TOKEN_PRICING_DEFAULTS as $action => $defaultCost) {
            $cost = $pricing[$action] ?? $defaultCost;
            $normalized[$action] = max(1, (int) $cost);
        }

        return $normalized;
    }

    /**
     * @param  array<string, mixed>  $state
     * @return array<int, array<string, mixed>>
     */
    private function tokenActionsCatalog(array $state): array
    {
        $pricing = $this->normalizeTokenPricing(
            is_array($state['tokenPricing'] ?? null) ? $state['tokenPricing'] : []
        );

        return collect(self::TOKEN_ACTIONS)
            ->map(function (string $label, string $action) use ($pricing): array {
                return [
                    'action' => $action,
                    'label' => $label,
                    'cost' => $pricing[$action] ?? self::TOKEN_PRICING_DEFAULTS[$action],
                ];
            })
            ->values()
            ->all();
    }

    private function tokenActionLabel(string $action): ?string
    {
        return self::TOKEN_ACTIONS[$action] ?? null;
    }

    /**
     * @param  array<string, mixed>  $state
     */
    private function tokenCost(array $state, string $action): int
    {
        if (! isset(self::TOKEN_ACTIONS[$action])) {
            throw ValidationException::withMessages([
                'action' => 'A acao de token informada nao e valida.',
            ]);
        }

        $pricing = $this->normalizeTokenPricing(
            is_array($state['tokenPricing'] ?? null) ? $state['tokenPricing'] : []
        );

        return $pricing[$action] ?? self::TOKEN_PRICING_DEFAULTS[$action];
    }

    /**
     * @param  array<string, mixed>  $state
     */
    private function companyNameFromState(array $state, string $companyId): string
    {
        $companyUser = collect($state['users'] ?? [])
            ->first(function (array $user) use ($companyId): bool {
                return (string) ($user['id'] ?? '') === $companyId
                    && ($user['role'] ?? null) === 'empresa';
            });

        if (is_array($companyUser)) {
            return (string) ($companyUser['company'] ?? $companyUser['name'] ?? 'Empresa');
        }

        $companyFromJob = collect($state['jobs'] ?? [])
            ->first(function (array $job) use ($companyId): bool {
                return (string) ($job['companyId'] ?? '') === $companyId;
            });

        if (is_array($companyFromJob)) {
            return (string) ($companyFromJob['company'] ?? 'Empresa');
        }

        return 'Empresa '.$companyId;
    }

    /**
     * @param  array<string, mixed>  $state
     * @return array<string, mixed>
     */
    private function companyWalletFromState(array $state, string $companyId): array
    {
        $wallet = collect($state['tokenWallets'] ?? [])->firstWhere('companyId', $companyId);

        if (! is_array($wallet)) {
            return [
                'companyId' => $companyId,
                'companyName' => $this->companyNameFromState($state, $companyId),
                'balance' => self::DEFAULT_COMPANY_TOKEN_BALANCE,
                'purchased' => self::DEFAULT_COMPANY_TOKEN_BALANCE,
                'spent' => 0,
                'createdAt' => now()->toDateTimeString(),
                'updatedAt' => now()->toDateTimeString(),
            ];
        }

        return [
            'companyId' => $companyId,
            'companyName' => (string) ($wallet['companyName'] ?? $this->companyNameFromState($state, $companyId)),
            'balance' => max(0, (int) ($wallet['balance'] ?? 0)),
            'purchased' => max(0, (int) ($wallet['purchased'] ?? 0)),
            'spent' => max(0, (int) ($wallet['spent'] ?? 0)),
            'createdAt' => (string) ($wallet['createdAt'] ?? now()->toDateTimeString()),
            'updatedAt' => (string) ($wallet['updatedAt'] ?? now()->toDateTimeString()),
        ];
    }

    /**
     * @param  array<string, mixed>  $state
     * @return array<int, array<string, mixed>>
     */
    private function companyTokenTransactionsFromState(array $state, string $companyId, int $limit = 20): array
    {
        $safeLimit = max(1, min(200, $limit));

        return collect($state['tokenTransactions'] ?? [])
            ->filter(function (array $transaction) use ($companyId): bool {
                return (string) ($transaction['companyId'] ?? '') === $companyId;
            })
            ->sortByDesc('createdAt')
            ->take($safeLimit)
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    private function creditCompanyTokens(
        array $state,
        string $companyId,
        int $tokens,
        string $action,
        string $description,
        array $metadata = [],
    ): array {
        $state = $this->normalizeState($state);
        $wallet = $this->companyWalletFromState($state, $companyId);

        $updatedWallet = [
            ...$wallet,
            'companyName' => $this->companyNameFromState($state, $companyId),
            'balance' => $wallet['balance'] + max(0, $tokens),
            'purchased' => $wallet['purchased'] + max(0, $tokens),
            'updatedAt' => now()->toDateTimeString(),
        ];

        $state = $this->upsertCompanyWallet($state, $updatedWallet);
        $state = $this->appendTokenTransaction($state, [
            'companyId' => $companyId,
            'direction' => 'credit',
            'action' => $action,
            'description' => $description,
            'tokens' => max(0, $tokens),
            'balanceAfter' => $updatedWallet['balance'],
            'metadata' => $metadata,
            'createdAt' => now()->toDateTimeString(),
        ]);

        return $state;
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    private function debitCompanyTokens(
        array $state,
        string $companyId,
        string $action,
        ?string $description = null,
        array $metadata = [],
    ): array {
        $state = $this->normalizeState($state);
        $wallet = $this->companyWalletFromState($state, $companyId);
        $cost = $this->tokenCost($state, $action);

        if ($wallet['balance'] < $cost) {
            throw ValidationException::withMessages([
                'tokens' => 'Saldo insuficiente para '.$this->tokenActionLabel($action)
                    .'. Saldo atual: '.$wallet['balance'].' token(s). Custo: '.$cost.' token(s).',
            ]);
        }

        $updatedWallet = [
            ...$wallet,
            'companyName' => $this->companyNameFromState($state, $companyId),
            'balance' => max(0, $wallet['balance'] - $cost),
            'spent' => $wallet['spent'] + $cost,
            'updatedAt' => now()->toDateTimeString(),
        ];

        $state = $this->upsertCompanyWallet($state, $updatedWallet);
        $state = $this->appendTokenTransaction($state, [
            'companyId' => $companyId,
            'direction' => 'debit',
            'action' => $action,
            'description' => $description ?: ($this->tokenActionLabel($action) ?? 'Consumo de tokens.'),
            'tokens' => -$cost,
            'balanceAfter' => $updatedWallet['balance'],
            'metadata' => [
                ...$metadata,
                'cost' => $cost,
            ],
            'createdAt' => now()->toDateTimeString(),
        ]);

        return $state;
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $wallet
     * @return array<string, mixed>
     */
    private function upsertCompanyWallet(array $state, array $wallet): array
    {
        $walletUpdated = false;

        $state['tokenWallets'] = collect($state['tokenWallets'] ?? [])
            ->map(function (array $existingWallet) use ($wallet, &$walletUpdated): array {
                if ((string) ($existingWallet['companyId'] ?? '') !== (string) ($wallet['companyId'] ?? '')) {
                    return $existingWallet;
                }

                $walletUpdated = true;

                return $wallet;
            })
            ->values()
            ->all();

        if (! $walletUpdated) {
            $state['tokenWallets'] = [...($state['tokenWallets'] ?? []), $wallet];
        }

        return $state;
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $transaction
     * @return array<string, mixed>
     */
    private function appendTokenTransaction(array $state, array $transaction): array
    {
        $existingTransactions = collect($state['tokenTransactions'] ?? [])->values()->all();

        $state['tokenTransactions'] = collect([
            [
                ...$transaction,
                'id' => $this->nextId($existingTransactions),
            ],
            ...$existingTransactions,
        ])
            ->take(400)
            ->values()
            ->all();

        return $state;
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $changes
     * @return array<string, mixed>
     */
    private function updateCandidateAndApplications(array $state, string $candidateId, array $changes): array
    {
        $candidateUpdated = false;
        $updatedCandidate = null;

        $state['candidates'] = collect($state['candidates'] ?? [])
            ->map(function (array $candidate) use ($candidateId, $changes, &$candidateUpdated, &$updatedCandidate): array {
                if (($candidate['id'] ?? null) !== $candidateId) {
                    return $candidate;
                }

                $candidateUpdated = true;
                $updatedCandidate = [
                    ...$candidate,
                    ...$changes,
                ];

                return $updatedCandidate;
            })
            ->values()
            ->all();

        if (! $candidateUpdated || ! is_array($updatedCandidate)) {
            throw ValidationException::withMessages([
                'candidateId' => 'O candidato informado nao foi encontrado.',
            ]);
        }

        $state['applications'] = collect($state['applications'] ?? [])
            ->map(function (array $application) use ($candidateId, $updatedCandidate): array {
                if (($application['candidateId'] ?? null) !== $candidateId) {
                    return $application;
                }

                $application['candidate'] = $updatedCandidate;

                return $application;
            })
            ->values()
            ->all();

        return [
            'state' => $state,
            'candidate' => $updatedCandidate,
        ];
    }

    /**
     * @param  array<string, mixed>  $state
     */
    private function ensureCandidateExists(array $state, string $candidateId): void
    {
        $candidate = collect($state['candidates'] ?? [])->firstWhere('id', $candidateId);

        if (! is_array($candidate)) {
            throw ValidationException::withMessages([
                'candidateId' => 'O candidato informado nao foi encontrado.',
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $state
     * @return array<string, mixed>
     */
    private function defaultSettings(array $state, string $role, string $userId): array
    {
        $user = collect($state['users'] ?? [])->firstWhere('id', $userId);

        return [
            'displayName' => (string) ($user['name'] ?? ''),
            'email' => (string) ($user['email'] ?? ''),
            'workspace' => (string) ($user['company'] ?? ''),
            'notes' => '',
            'browserAlerts' => true,
            'emailDigest' => true,
            'smartRecommendations' => true,
            'profileVisibility' => $role !== 'admin',
            'timezone' => 'America/Sao_Paulo',
        ];
    }

    /**
     * @param  array<string, mixed>  $discAnswers
     * @return array<string, int>
     */
    private function normalizeDiscAnswers(array $discAnswers): array
    {
        return [
            'dominance' => (int) ($discAnswers['dominance'] ?? 50),
            'influence' => (int) ($discAnswers['influence'] ?? 50),
            'steadiness' => (int) ($discAnswers['steadiness'] ?? 50),
            'conscientiousness' => (int) ($discAnswers['conscientiousness'] ?? 50),
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $answers
     * @return array<int, array<string, string>>
     */
    private function normalizeCustomAnswers(array $answers): array
    {
        return collect($answers)
            ->map(function (array $answer): array {
                return [
                    'questionId' => (string) ($answer['questionId'] ?? ''),
                    'question' => (string) ($answer['question'] ?? ''),
                    'answer' => (string) ($answer['answer'] ?? ''),
                ];
            })
            ->filter(fn (array $answer): bool => $answer['questionId'] !== '')
            ->values()
            ->all();
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     */
    private function nextId(array $items): string
    {
        $maxId = collect($items)
            ->map(fn (array $item): int => (int) ($item['id'] ?? 0))
            ->max();

        return (string) (($maxId ?? 0) + 1);
    }

    private function normalizeExperience(string $range): int
    {
        return match ($range) {
            '0-1' => 1,
            '2-3' => 3,
            '4-5' => 5,
            '6+' => 6,
            default => is_numeric($range) ? (int) $range : 0,
        };
    }
}
