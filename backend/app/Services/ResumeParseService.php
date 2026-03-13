<?php

namespace App\Services;

use App\Models\Resume;
use App\Models\ResumeParse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ResumeParseService
{
    public function __construct(
        private readonly DemoStateService $demoStateService,
        private readonly ResumeTextExtractorService $resumeTextExtractorService,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function parseForRun(int $analysisRunId, string $applicationId): array
    {
        $analysisPayload = $this->demoStateService->applicationAnalysis($applicationId);
        $application = is_array($analysisPayload['application'] ?? null) ? $analysisPayload['application'] : [];
        $candidate = is_array($application['candidate'] ?? null) ? $application['candidate'] : [];
        $candidateId = (string) ($application['candidateId'] ?? $candidate['id'] ?? '');

        if ($candidateId === '') {
            return [
                'status' => 'skipped',
                'reason' => 'candidate_not_found',
                'candidateId' => null,
            ];
        }

        $resume = $this->findOrCreateResume($candidateId, $applicationId, $candidate);

        if (! $resume) {
            return [
                'status' => 'skipped',
                'reason' => 'resume_not_found',
                'candidateId' => $candidateId,
                'detectedSkills' => [],
            ];
        }

        $absolutePath = $this->resolveLocalResumePath($resume->file_url);

        if (! $absolutePath || ! is_file($absolutePath)) {
            $parse = ResumeParse::query()->create([
                'resume_id' => $resume->id,
                'analysis_run_id' => $analysisRunId,
                'parse_status' => 'failed',
                'ocr_used' => false,
                'error_message' => 'Arquivo de curriculo nao encontrado no armazenamento.',
                'parsed_at' => Carbon::now(),
            ]);

            return [
                'status' => 'failed',
                'reason' => 'resume_file_missing',
                'candidateId' => $candidateId,
                'resumeId' => $resume->id,
                'resumeParseId' => $parse->id,
                'detectedSkills' => [],
            ];
        }

        $extraction = $this->resumeTextExtractorService->extract($absolutePath, $resume->mime, $resume->file_name);
        $rawText = trim((string) ($extraction['rawText'] ?? ''));
        $parseStatus = $rawText !== '' ? 'completed' : 'failed';
        $language = $rawText !== '' ? $this->detectLanguage($rawText) : null;

        $normalized = $rawText !== '' ? $this->buildNormalizedPayload($rawText) : [];
        $confidence = $rawText !== '' ? $this->buildConfidencePayload($rawText, $normalized) : [];

        $parse = ResumeParse::query()->create([
            'resume_id' => $resume->id,
            'analysis_run_id' => $analysisRunId,
            'parse_status' => $parseStatus,
            'ocr_used' => (bool) ($extraction['ocrUsed'] ?? false),
            'language' => $language,
            'raw_text' => $rawText !== '' ? $rawText : null,
            'normalized_json' => $normalized !== [] ? $normalized : null,
            'confidence_json' => $confidence !== [] ? $confidence : null,
            'error_message' => $parseStatus === 'failed'
                ? (string) ($extraction['error'] ?? 'Falha ao extrair texto do curriculo.')
                : null,
            'parsed_at' => Carbon::now(),
        ]);

        return [
            'status' => $parseStatus,
            'candidateId' => $candidateId,
            'resumeId' => $resume->id,
            'resumeParseId' => $parse->id,
            'ocrUsed' => (bool) ($extraction['ocrUsed'] ?? false),
            'engine' => (string) ($extraction['engine'] ?? 'unknown'),
            'language' => $language,
            'charCount' => strlen($rawText),
            'detectedSkills' => $this->extractSkillsFromNormalized($normalized),
            'extractedLinkedinUrls' => $this->extractLinkedinUrlsFromNormalized($normalized),
            'sectionsDetected' => is_array($normalized['sectionsDetected'] ?? null) ? $normalized['sectionsDetected'] : [],
            'experienceHintsCount' => is_array($normalized['experienceHints'] ?? null)
                ? count($normalized['experienceHints'])
                : 0,
            'educationHintsCount' => is_array($normalized['educationHints'] ?? null)
                ? count($normalized['educationHints'])
                : 0,
            'inferredExperienceYears' => is_numeric($normalized['inferredExperienceYears'] ?? null)
                ? (int) $normalized['inferredExperienceYears']
                : null,
            'educationSummary' => is_string($normalized['educationSummary'] ?? null)
                ? (string) $normalized['educationSummary']
                : null,
            'confidence' => $confidence,
            'parsedAt' => $parse->parsed_at?->toDateTimeString(),
            'error' => $parseStatus === 'failed'
                ? (string) ($extraction['error'] ?? 'Falha ao extrair texto do curriculo.')
                : null,
        ];
    }

    /**
     * @param  array<string, mixed>  $candidate
     */
    private function findOrCreateResume(string $candidateId, string $applicationId, array $candidate): ?Resume
    {
        $resume = Resume::query()
            ->where('candidate_id', $candidateId)
            ->whereNotNull('file_url')
            ->latest('uploaded_at')
            ->latest('id')
            ->first();

        if ($resume) {
            if (! $resume->application_id) {
                $resume->application_id = $applicationId;
                $resume->save();
            }

            return $resume;
        }

        $resumeUrl = trim((string) ($candidate['resumeUrl'] ?? ''));

        if ($resumeUrl === '') {
            return null;
        }

        $resumeFileName = trim((string) ($candidate['resumeFileName'] ?? ''));
        if ($resumeFileName === '') {
            $resumeFileName = basename((string) parse_url($resumeUrl, PHP_URL_PATH));
            $resumeFileName = $resumeFileName !== '' ? $resumeFileName : 'curriculo.pdf';
        }

        return Resume::query()->create([
            'candidate_id' => $candidateId,
            'application_id' => $applicationId,
            'source' => 'candidate_snapshot',
            'file_name' => $resumeFileName,
            'file_url' => $resumeUrl,
            'file_hash' => null,
            'mime' => null,
            'size_bytes' => null,
            'uploaded_at' => Carbon::now(),
        ]);
    }

    private function resolveLocalResumePath(?string $resumeUrl): ?string
    {
        if (! is_string($resumeUrl) || trim($resumeUrl) === '') {
            return null;
        }

        $path = (string) (parse_url($resumeUrl, PHP_URL_PATH) ?? $resumeUrl);
        $path = trim($path);

        if ($path === '') {
            return null;
        }

        if (str_starts_with($path, '/storage/')) {
            return Storage::disk('public')->path(substr($path, strlen('/storage/')));
        }

        if (str_starts_with($path, 'storage/')) {
            return Storage::disk('public')->path(substr($path, strlen('storage/')));
        }

        if (is_file($path)) {
            return $path;
        }

        $publicPath = public_path(ltrim($path, '/'));
        if (is_file($publicPath)) {
            return $publicPath;
        }

        $storagePublicPath = storage_path('app/public/'.ltrim($path, '/'));
        if (is_file($storagePublicPath)) {
            return $storagePublicPath;
        }

        return null;
    }

    private function detectLanguage(string $text): string
    {
        $sample = Str::lower(' '.Str::limit($text, 2000, '').' ');
        $ptSignals = [' experiencia ', ' formacao ', ' habilidade ', ' curriculo ', ' desenvolvedor ', ' anos '];
        $enSignals = [' experience ', ' education ', ' skills ', ' resume ', ' developer ', ' years '];
        $ptScore = collect($ptSignals)->filter(fn (string $token): bool => str_contains($sample, $token))->count();
        $enScore = collect($enSignals)->filter(fn (string $token): bool => str_contains($sample, $token))->count();

        return $ptScore >= $enScore ? 'pt-BR' : 'en';
    }

    /**
     * @return array<string, mixed>
     */
    private function buildNormalizedPayload(string $rawText): array
    {
        preg_match_all('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i', $rawText, $emails);
        preg_match_all('/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)\]]+/i', $rawText, $linkedins);
        preg_match_all('/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}/', $rawText, $phones);

        $skillsCatalog = [
            'php', 'laravel', 'node.js', 'nodejs', 'react', 'typescript', 'javascript',
            'python', 'sql', 'aws', 'docker', 'kubernetes', 'figma', 'power bi', 'tableau',
        ];
        $normalizedText = Str::lower($rawText);

        $skills = collect($skillsCatalog)
            ->filter(function (string $skill) use ($normalizedText): bool {
                return str_contains($normalizedText, Str::lower($skill));
            })
            ->map(fn (string $skill): string => Str::title($skill))
            ->values()
            ->all();

        $experienceHints = $this->extractExperienceHints($rawText);
        $educationHints = $this->extractEducationHints($rawText);
        $sectionsDetected = $this->detectSections($rawText);
        $inferredExperienceYears = $this->inferExperienceYears($rawText, $experienceHints);
        $educationSummary = $educationHints[0] ?? null;
        $lines = array_values(array_filter(
            explode("\n", $rawText),
            fn (string $line): bool => trim($line) !== ''
        ));

        return [
            'contact' => [
                'emails' => collect($emails[0] ?? [])->unique()->values()->all(),
                'linkedinUrls' => collect($linkedins[0] ?? [])->unique()->values()->all(),
                'phones' => collect($phones[0] ?? [])
                    ->map(fn (string $phone): string => trim($phone))
                    ->unique()
                    ->values()
                    ->all(),
            ],
            'skills' => $skills,
            'educationHints' => $educationHints,
            'experienceHints' => $experienceHints,
            'sectionsDetected' => $sectionsDetected,
            'inferredExperienceYears' => $inferredExperienceYears,
            'educationSummary' => $educationSummary,
            'emails' => collect($emails[0] ?? [])->unique()->values()->all(),
            'linkedinUrls' => collect($linkedins[0] ?? [])->unique()->values()->all(),
            'skillsDetected' => $skills,
            'charCount' => strlen($rawText),
            'lineCount' => count($lines),
            'headline' => $lines[0] ?? null,
        ];
    }

    /**
     * @param  array<string, mixed>  $normalized
     * @return array<string, float>
     */
    private function buildConfidencePayload(string $rawText, array $normalized): array
    {
        $charCount = strlen($rawText);
        $contact = is_array($normalized['contact'] ?? null) ? $normalized['contact'] : [];
        $emails = is_array($contact['emails'] ?? null)
            ? $contact['emails']
            : (is_array($normalized['emails'] ?? null) ? $normalized['emails'] : []);
        $skills = is_array($normalized['skills'] ?? null)
            ? $normalized['skills']
            : (is_array($normalized['skillsDetected'] ?? null) ? $normalized['skillsDetected'] : []);
        $experienceHints = is_array($normalized['experienceHints'] ?? null) ? $normalized['experienceHints'] : [];
        $educationHints = is_array($normalized['educationHints'] ?? null) ? $normalized['educationHints'] : [];
        $inferredYears = is_numeric($normalized['inferredExperienceYears'] ?? null)
            ? (int) $normalized['inferredExperienceYears']
            : 0;

        return [
            'textExtraction' => round(min(1, $charCount / 1800), 2),
            'contactExtraction' => count($emails) > 0 ? 0.9 : 0.35,
            'skillsExtraction' => round(min(1, max(0.2, count($skills) / 6)), 2),
            'experienceExtraction' => $inferredYears > 0 ? 0.9 : (count($experienceHints) > 0 ? 0.8 : 0.4),
            'educationExtraction' => count($educationHints) > 0 ? 0.82 : 0.45,
        ];
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function extractExperienceHints(string $rawText): array
    {
        $experiencePatterns = [
            '/(?<title>[A-Za-zÀ-ÿ0-9\s\/\-\+]{3,60})\s+(?:na|at|em)\s+(?<company>[A-Za-zÀ-ÿ0-9&\.\-\s]{2,60})\s*[-–]\s*(?<period>(?:\d{4}|\w+\/\d{4}).{0,20})/iu',
            '/(?<period>(?:\d{2}\/\d{4}|\d{4})\s*(?:-|ate|to)\s*(?:\d{2}\/\d{4}|\d{4}|atual|present)).{0,80}/iu',
        ];

        $hints = [];

        foreach ($experiencePatterns as $pattern) {
            preg_match_all($pattern, $rawText, $matches, PREG_SET_ORDER);

            foreach ($matches as $match) {
                $title = isset($match['title']) ? trim((string) $match['title']) : '';
                $company = isset($match['company']) ? trim((string) $match['company']) : '';
                $period = isset($match['period']) ? trim((string) $match['period']) : trim((string) ($match[0] ?? ''));

                if ($title === '' && $company === '' && $period === '') {
                    continue;
                }

                $hints[] = [
                    'title' => $title,
                    'company' => $company,
                    'period' => Str::limit($period, 80, ''),
                ];
            }
        }

        return collect($hints)
            ->unique(function (array $item): string {
                return Str::lower($item['title'].'|'.$item['company'].'|'.$item['period']);
            })
            ->take(8)
            ->values()
            ->all();
    }

    /**
     * @return array<int, string>
     */
    private function extractEducationHints(string $rawText): array
    {
        $lines = explode("\n", $rawText);
        $tokens = [
            'graduacao', 'bacharel', 'licenciatura', 'tecnologo', 'pos-graduacao',
            'mba', 'mestrado', 'doutorado', 'universidade', 'faculdade', 'college', 'university',
        ];

        return collect($lines)
            ->map(fn (string $line): string => trim($line))
            ->filter(function (string $line) use ($tokens): bool {
                $normalized = Str::lower($line);

                return collect($tokens)->contains(fn (string $token): bool => str_contains($normalized, $token));
            })
            ->take(6)
            ->values()
            ->all();
    }

    /**
     * @return array<int, string>
     */
    private function detectSections(string $rawText): array
    {
        $normalized = Str::lower($rawText);
        $map = [
            'experience' => ['experiencia', 'experience', 'historico profissional'],
            'education' => ['formacao', 'education', 'academica'],
            'skills' => ['skills', 'habilidades', 'competencias'],
            'certifications' => ['certificacao', 'certifications', 'certificados'],
            'languages' => ['idiomas', 'languages'],
            'projects' => ['projetos', 'projects', 'portfolio'],
        ];

        return collect($map)
            ->filter(function (array $tokens) use ($normalized): bool {
                return collect($tokens)->contains(fn (string $token): bool => str_contains($normalized, $token));
            })
            ->keys()
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $normalized
     * @return array<int, string>
     */
    private function extractSkillsFromNormalized(array $normalized): array
    {
        $skills = is_array($normalized['skills'] ?? null)
            ? $normalized['skills']
            : (is_array($normalized['skillsDetected'] ?? null) ? $normalized['skillsDetected'] : []);

        return collect($skills)
            ->map(fn ($skill): string => trim((string) $skill))
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $normalized
     * @return array<int, string>
     */
    private function extractLinkedinUrlsFromNormalized(array $normalized): array
    {
        $contact = is_array($normalized['contact'] ?? null) ? $normalized['contact'] : [];
        $urls = is_array($contact['linkedinUrls'] ?? null)
            ? $contact['linkedinUrls']
            : (is_array($normalized['linkedinUrls'] ?? null) ? $normalized['linkedinUrls'] : []);

        return collect($urls)
            ->map(fn ($url): string => trim((string) $url))
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @param  array<int, array<string, string>>  $experienceHints
     */
    private function inferExperienceYears(string $rawText, array $experienceHints): int
    {
        $normalizedText = Str::lower($rawText);
        $years = [];

        preg_match_all('/\b(\d{1,2})\+?\s*(?:anos?|years?)\b/u', $normalizedText, $yearMatches);
        foreach ($yearMatches[1] ?? [] as $matchedYear) {
            $value = (int) $matchedYear;
            if ($value > 0 && $value <= 45) {
                $years[] = $value;
            }
        }

        $allPeriods = collect($experienceHints)
            ->map(fn (array $hint): string => (string) ($hint['period'] ?? ''))
            ->filter()
            ->values()
            ->all();

        foreach ($allPeriods as $period) {
            preg_match_all('/(19\d{2}|20\d{2})\s*(?:-|–|ate|to)\s*(19\d{2}|20\d{2}|atual|present)/iu', $period, $rangeMatches, PREG_SET_ORDER);

            foreach ($rangeMatches as $match) {
                $start = (int) ($match[1] ?? 0);
                $endToken = Str::lower((string) ($match[2] ?? ''));
                $end = in_array($endToken, ['atual', 'present'], true) ? (int) now()->format('Y') : (int) $endToken;

                if ($start > 0 && $end >= $start) {
                    $diff = max(1, $end - $start);
                    if ($diff <= 45) {
                        $years[] = $diff;
                    }
                }
            }
        }

        if ($years === []) {
            return 0;
        }

        return max($years);
    }
}
