<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CompanyReportsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_company_reports_endpoints_return_expected_payloads(): void
    {
        $this->getJson('/api/company/reports/overview?companyId=2')
            ->assertOk()
            ->assertJsonStructure([
                'overview' => [
                    'companyId',
                    'jobsTotal',
                    'applicationsTotal',
                    'averageCompatibility',
                ],
            ]);

        $this->getJson('/api/company/reports/funnel?companyId=2')
            ->assertOk()
            ->assertJsonStructure([
                'companyId',
                'totalApplications',
                'stages',
            ]);

        $this->getJson('/api/company/reports/sources?companyId=2')
            ->assertOk()
            ->assertJsonStructure([
                'companyId',
                'total',
                'sources',
                'leadBreakdown' => ['pending', 'submitted'],
            ]);

        $this->getJson('/api/company/reports/hiring-time?companyId=2')
            ->assertOk()
            ->assertJsonStructure([
                'companyId',
                'sampleSize',
                'averageDays',
                'minDays',
                'maxDays',
            ]);
    }

    public function test_analysis_export_endpoint_returns_summary(): void
    {
        $this->getJson('/api/admin/applications/1/analysis/export')
            ->assertOk()
            ->assertJsonStructure([
                'applicationId',
                'generatedAt',
                'candidate',
                'job',
                'reportMarkdown',
                'summary' => [
                    'compatibilityScore',
                    'overallScore',
                    'primaryDiscType',
                    'lifePathNumber',
                ],
            ]);
    }
}
