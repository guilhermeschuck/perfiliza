<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminJobsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_update_and_delete_job(): void
    {
        $createResponse = $this->postJson('/api/admin/jobs', [
            'companyId' => '2',
            'title' => 'QA Automation Engineer',
            'department' => 'Qualidade',
            'location' => 'Remoto',
            'type' => 'CLT',
            'level' => 'Pleno',
            'description' => 'Responsavel por automacao de testes e qualidade de entrega.',
            'requirements' => ['Cypress', 'Playwright'],
            'benefits' => ['Plano de saude'],
            'status' => 'active',
            'scoreWeights' => [
                'technicalSkills' => 0.30,
                'softSkills' => 0.10,
                'experienceRelevance' => 0.25,
                'educationMatch' => 0.10,
                'cultureFit' => 0.15,
                'consistencyScore' => 0.10,
            ],
        ]);

        $createResponse
            ->assertCreated()
            ->assertJsonPath('job.title', 'QA Automation Engineer')
            ->assertJsonPath('job.scoreWeights.technicalSkills', 0.3)
            ->assertJsonPath('job.scoreWeights.consistencyScore', 0.1);

        $jobId = (string) $createResponse->json('job.id');
        $this->assertNotSame('', $jobId);

        $updateResponse = $this->patchJson('/api/admin/jobs/'.$jobId, [
            'status' => 'paused',
            'salary' => [
                'min' => 9000,
                'max' => 12000,
            ],
            'scoreWeights' => [
                'technicalSkills' => 0.4,
                'softSkills' => 0.1,
                'experienceRelevance' => 0.2,
                'educationMatch' => 0.1,
                'cultureFit' => 0.1,
                'consistencyScore' => 0.1,
            ],
        ]);

        $updateResponse
            ->assertOk()
            ->assertJsonPath('job.status', 'paused')
            ->assertJsonPath('job.salary.min', 9000)
            ->assertJsonPath('job.salary.max', 12000)
            ->assertJsonPath('job.scoreWeights.technicalSkills', 0.4)
            ->assertJsonPath('job.scoreWeights.experienceRelevance', 0.2);

        $this->deleteJson('/api/admin/jobs/'.$jobId)
            ->assertOk()
            ->assertJsonPath('deletedJobId', $jobId);
    }

    public function test_admin_job_status_and_candidates_endpoints_return_data(): void
    {
        $this->patchJson('/api/admin/jobs/1/status', [
            'status' => 'paused',
        ])->assertOk()->assertJsonPath('job.status', 'paused');

        $this->patchJson('/api/admin/jobs/1/status', [
            'status' => 'active',
        ])->assertOk()->assertJsonPath('job.status', 'active');

        $this->getJson('/api/admin/jobs/1/candidates')
            ->assertOk()
            ->assertJsonStructure([
                'job' => ['id', 'title', 'companyId'],
                'applications',
                'total',
            ]);
    }
}
