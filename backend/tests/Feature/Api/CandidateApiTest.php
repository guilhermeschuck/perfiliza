<?php

namespace Tests\Feature\Api;

use App\Models\Resume;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class CandidateApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_candidate_profile_can_be_read_and_updated(): void
    {
        $this->getJson('/api/candidate/profile?candidateId=3')
            ->assertOk()
            ->assertJsonPath('candidate.id', '3');

        $this->patchJson('/api/candidate/profile', [
            'candidateId' => '3',
            'status' => 'open_to_offers',
            'bio' => 'Atualizado no teste.',
            'skills' => ['Python', 'SQL'],
        ])
            ->assertOk()
            ->assertJsonPath('candidate.status', 'open_to_offers')
            ->assertJsonPath('candidate.bio', 'Atualizado no teste.')
            ->assertJsonPath('candidate.skills.0', 'Python');
    }

    public function test_candidate_resume_can_be_uploaded_and_removed(): void
    {
        $file = UploadedFile::fake()->create('curriculo.pdf', 120);

        $this->postJson('/api/candidate/profile/resume', [
            'candidateId' => '3',
            'resumeFile' => $file,
        ])
            ->assertCreated()
            ->assertJsonPath('candidateId', '3')
            ->assertJsonPath('hasResume', true);

        $this->assertDatabaseHas('resumes', [
            'candidate_id' => '3',
            'file_name' => 'curriculo.pdf',
            'source' => 'candidate_profile',
        ]);

        $resume = Resume::query()->latest('id')->first();
        $this->assertNotNull($resume);
        $this->assertNotNull($resume?->file_hash);

        $this->deleteJson('/api/candidate/profile/resume?candidateId=3')
            ->assertOk()
            ->assertJsonPath('candidateId', '3')
            ->assertJsonPath('hasResume', false);
    }

    public function test_candidate_notification_can_be_marked_as_read(): void
    {
        $notificationsResponse = $this->getJson('/api/candidate/notifications?candidateId=3')
            ->assertOk()
            ->assertJsonStructure([
                'notifications',
            ]);

        $notifications = $notificationsResponse->json('notifications');
        $notificationId = $notifications[0]['id'] ?? null;
        $this->assertNotNull($notificationId);

        $this->postJson('/api/candidate/notifications/'.$notificationId.'/read', [
            'candidateId' => '3',
        ])
            ->assertOk()
            ->assertJsonPath('notifications.0.id', $notificationId)
            ->assertJsonPath('notifications.0.read', true);
    }

    public function test_candidate_saved_jobs_can_be_listed_saved_and_removed(): void
    {
        $this->getJson('/api/candidate/saved-jobs?candidateId=3')
            ->assertOk()
            ->assertJsonPath('candidateId', '3')
            ->assertJsonPath('jobIds', []);

        $savedResponse = $this->postJson('/api/candidate/saved-jobs', [
            'candidateId' => '3',
            'jobId' => '1',
        ])
            ->assertOk()
            ->assertJsonPath('candidateId', '3');

        $this->assertSame(['1'], $savedResponse->json('jobIds'));

        $this->postJson('/api/candidate/saved-jobs', [
            'candidateId' => '3',
            'jobId' => '1',
        ])
            ->assertOk()
            ->assertJsonPath('jobIds', ['1']);

        $this->deleteJson('/api/candidate/saved-jobs/1?candidateId=3')
            ->assertOk()
            ->assertJsonPath('candidateId', '3')
            ->assertJsonPath('jobIds', []);
    }

    public function test_candidate_cannot_save_unknown_job(): void
    {
        $this->postJson('/api/candidate/saved-jobs', [
            'candidateId' => '3',
            'jobId' => '999999',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['jobId']);
    }

    public function test_candidate_can_withdraw_own_application(): void
    {
        $today = now()->toDateString();

        $response = $this->postJson('/api/candidate/applications/3/withdraw', [
            'candidateId' => '3',
        ])
            ->assertOk()
            ->assertJsonPath('application.id', '3')
            ->assertJsonPath('application.status', 'rejected')
            ->assertJsonPath('application.withdrawnByCandidate', true)
            ->assertJsonPath('application.withdrawnAt', $today);

        $notes = (string) $response->json('application.notes');
        $this->assertStringContainsString('Candidatura retirada pelo candidato em '.$today.'.', $notes);

        $notificationsResponse = $this->getJson('/api/candidate/notifications?candidateId=3')
            ->assertOk();

        $notification = collect($notificationsResponse->json('notifications'))
            ->firstWhere('id', 'application-3');

        $this->assertNotNull($notification);
        $this->assertSame('Voce retirou essa candidatura.', $notification['message']);
    }

    public function test_candidate_cannot_withdraw_application_from_another_candidate(): void
    {
        $this->postJson('/api/candidate/applications/1/withdraw', [
            'candidateId' => '3',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['applicationId']);
    }
}
