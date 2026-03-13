<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminAnalysisRunsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_start_analysis_returns_run_identifier_and_status_detail(): void
    {
        $startResponse = $this->postJson('/api/admin/applications/1/analysis/start')
            ->assertOk()
            ->assertJsonStructure([
                'application',
                'analysis',
                'reprocessed',
                'queued',
                'analysisRun' => [
                    'id',
                    'applicationId',
                    'status',
                    'queueConnection',
                    'queueName',
                ],
            ])
            ->assertJsonPath('analysisRun.applicationId', '1')
            ->assertJsonPath('analysisRun.status', 'completed');

        $analysisRunId = (int) $startResponse->json('analysisRun.id');
        $this->assertGreaterThan(0, $analysisRunId);

        $analysisRunResponse = $this->getJson('/api/admin/analysis-runs/'.$analysisRunId)
            ->assertOk()
            ->assertJsonPath('analysisRun.id', $analysisRunId)
            ->assertJsonPath('analysisRun.applicationId', '1')
            ->assertJsonPath('analysisRun.status', 'completed')
            ->assertJsonPath('analysisRun.timeline.0.step', 'queued')
            ->assertJsonPath('candidateProfileAi.candidateId', '1');
        $this->assertIsInt($analysisRunResponse->json('score.compatibilityScore'));

        $this->getJson('/api/admin/analysis-runs/'.$analysisRunId.'/events')
            ->assertOk()
            ->assertJsonPath('analysisRunId', $analysisRunId)
            ->assertJsonPath('applicationId', '1')
            ->assertJsonPath('status', 'completed')
            ->assertJsonPath('events.0.step', 'queued');

        $this->getJson('/api/admin/applications/1/analysis')
            ->assertOk()
            ->assertJsonPath('analysisRun.id', $analysisRunId)
            ->assertJsonPath('analysisRun.status', 'completed')
            ->assertJsonPath('analysisRun.timeline.1.step', 'analysis_processing')
            ->assertJsonPath('resumeParse', null)
            ->assertJsonPath('reportDocument.hasMarkdown', true);

        $exportResponse = $this->getJson('/api/admin/applications/1/analysis/export')
            ->assertOk()
            ->assertJsonPath('analysisRun.id', $analysisRunId)
            ->assertJsonPath('analysisRun.status', 'completed')
            ->assertJsonPath('resumeParse', null);
        $this->assertIsString($exportResponse->json('reportMarkdown'));
        $this->assertStringContainsString('Relatorio de Analise de Curriculo', (string) $exportResponse->json('reportMarkdown'));
        $this->assertIsString($exportResponse->json('reportDocument.pdfUrl'));
    }

    public function test_reprocess_analysis_creates_run_with_reprocess_flag(): void
    {
        $this->postJson('/api/admin/applications/1/analysis/reprocess')
            ->assertOk()
            ->assertJsonPath('reprocessed', true)
            ->assertJsonPath('analysisRun.reprocess', true);
    }

    public function test_start_analysis_creates_resume_parse_when_resume_exists(): void
    {
        Storage::fake('public');

        $this->postJson('/api/candidate/profile/resume', [
            'candidateId' => '1',
            'resumeFile' => UploadedFile::fake()->createWithContent(
                'curriculo.pdf',
                "Joao Silva\nEmail: joao.silva@email.com\nLinkedIn: https://linkedin.com/in/joaosilva\n".
                "8 anos de experiencia com Laravel, PHP, SQL e React em projetos corporativos.\n".
                "Bacharel em Sistemas de Informacao pela Universidade X.\n",
            ),
        ])->assertCreated();

        $startResponse = $this->postJson('/api/admin/applications/1/analysis/start')
            ->assertOk()
            ->assertJsonPath('analysisRun.status', 'completed');

        $analysisRunId = (int) $startResponse->json('analysisRun.id');

        $this->assertDatabaseHas('analysis_runs', [
            'id' => $analysisRunId,
            'status' => 'completed',
            'application_id' => '1',
        ]);

        $this->assertDatabaseHas('resume_parses', [
            'analysis_run_id' => $analysisRunId,
            'parse_status' => 'completed',
        ]);
        $this->assertDatabaseHas('analysis_scores', [
            'analysis_run_id' => $analysisRunId,
            'application_id' => '1',
        ]);
        $this->assertDatabaseHas('candidate_profiles_ai', [
            'analysis_run_id' => $analysisRunId,
            'candidate_id' => '1',
        ]);
        $this->assertDatabaseHas('analysis_audit_logs', [
            'analysis_run_id' => $analysisRunId,
            'event_key' => 'analysis.pipeline.completed',
            'stage' => 'pipeline_complete',
        ]);

        $this->getJson('/api/admin/analysis-runs/'.$analysisRunId)
            ->assertOk()
            ->assertJsonPath('analysisRun.metadata.pipeline.resumeParse.status', 'completed')
            ->assertJsonPath('analysisRun.metadata.pipeline.candidateEnrichment.experienceUpdated', true)
            ->assertJsonPath('analysisRun.metadata.pipeline.candidateEnrichment.skillsAdded', 3)
            ->assertJsonPath('analysisRun.metadata.pipeline.llmInsights.status', 'completed')
            ->assertJsonPath('timeline.2.step', 'resume_parse');

        $analysisResponse = $this->getJson('/api/admin/applications/1/analysis')
            ->assertOk()
            ->assertJsonPath('analysisRun.id', $analysisRunId)
            ->assertJsonPath('resumeParse.status', 'completed')
            ->assertJsonPath('resumeParse.ocrUsed', false)
            ->assertJsonPath('candidateProfileAi.candidateId', '1')
            ->assertJsonPath('application.candidate.experience', 8)
            ->assertJsonPath('analysis.aiAnalysis.experienceRelevance', 98)
            ->assertJsonPath('analysis.aiAnalysis.resumeSignals.detectedSkillsCount', 4)
            ->assertJsonPath('analysis.aiAnalysis.resumeSignals.linkedinMatched', false)
            ->assertJsonPath('analysis.aiAnalysis.scoreAdjustments.technicalSkills', 0)
            ->assertJsonPath('analysis.aiAnalysis.scoreAdjustments.experienceRelevance', 0)
            ->assertJsonPath('analysis.aiAnalysis.scoreAdjustments.requested.technicalSkills', 5)
            ->assertJsonPath('analysis.aiAnalysis.scoreAdjustments.requested.llm.applied', false)
            ->assertJsonPath('analysis.aiAnalysis.scoreAdjustments.requested.experienceRelevance', 0)
            ->assertJsonPath('application.candidate.skills.5', 'Php')
            ->assertJsonPath('application.candidate.skills.6', 'Laravel')
            ->assertJsonPath('application.candidate.skills.7', 'Sql');
        $this->assertIsInt($analysisResponse->json('analysisScore.compatibilityScore'));
        $this->assertIsInt($analysisResponse->json('analysis.consistencyScore'));
        $this->assertIsInt($analysisResponse->json('analysis.aiAnalysis.consistencyScore'));

        $analysisExportResponse = $this->getJson('/api/admin/applications/1/analysis/export')
            ->assertOk()
            ->assertJsonPath('analysisRun.id', $analysisRunId)
            ->assertJsonPath('resumeParse.status', 'completed');
        $this->assertIsString($analysisExportResponse->json('reportMarkdown'));
        $this->assertStringContainsString('Trilha de Score', (string) $analysisExportResponse->json('reportMarkdown'));

        $analysisRunResponse = $this->getJson('/api/admin/analysis-runs/'.$analysisRunId)
            ->assertOk()
            ->assertJsonPath('candidateProfileAi.candidateId', '1');
        $this->assertIsInt($analysisRunResponse->json('score.compatibilityScore'));
        $this->assertIsString($analysisRunResponse->json('auditLogs.0.stage'));
        $this->assertTrue((bool) $analysisRunResponse->json('reports.0.hasMarkdown'));
        $this->assertIsString($analysisRunResponse->json('reports.0.pdfUrl'));
    }

    public function test_analysis_run_review_endpoint_registers_manual_decision(): void
    {
        $startResponse = $this->postJson('/api/admin/applications/1/analysis/start')
            ->assertOk();
        $analysisRunId = (int) $startResponse->json('analysisRun.id');

        $this->postJson('/api/admin/analysis-runs/'.$analysisRunId.'/review', [
            'reviewerId' => 'admin-1',
            'decision' => 'needs_review',
            'rationale' => 'Necessario validar evidencias tecnicas em entrevista.',
            'tags' => ['entrevista_tecnica', 'validacao_portfolio'],
        ])
            ->assertCreated()
            ->assertJsonPath('decision.analysisRunId', $analysisRunId)
            ->assertJsonPath('latestDecision.reviewerId', 'admin-1')
            ->assertJsonPath('latestDecision.decision', 'needs_review');

        $this->getJson('/api/admin/analysis-runs/'.$analysisRunId.'/review')
            ->assertOk()
            ->assertJsonPath('latestDecision.reviewerId', 'admin-1')
            ->assertJsonPath('history.0.decision', 'needs_review');

        $this->getJson('/api/admin/analysis-runs/'.$analysisRunId)
            ->assertOk()
            ->assertJsonPath('review.latest.reviewerId', 'admin-1')
            ->assertJsonPath('review.latest.decision', 'needs_review');

        $this->assertDatabaseHas('analysis_review_decisions', [
            'analysis_run_id' => $analysisRunId,
            'reviewer_id' => 'admin-1',
            'decision' => 'needs_review',
        ]);
        $this->assertDatabaseHas('analysis_audit_logs', [
            'analysis_run_id' => $analysisRunId,
            'event_key' => 'analysis.manual_review.recorded',
            'stage' => 'manual_review',
        ]);
    }
}
