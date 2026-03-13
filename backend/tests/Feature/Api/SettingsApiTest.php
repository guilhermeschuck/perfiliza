<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettingsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_settings_can_be_read_and_updated_per_profile(): void
    {
        $this->getJson('/api/settings?role=candidato&userId=3')
            ->assertOk()
            ->assertJsonPath('role', 'candidato')
            ->assertJsonPath('userId', '3');

        $this->patchJson('/api/settings', [
            'role' => 'candidato',
            'userId' => '3',
            'settings' => [
                'emailDigest' => false,
                'notes' => 'Atualizado pelo teste.',
            ],
        ])
            ->assertOk()
            ->assertJsonPath('settings.emailDigest', false)
            ->assertJsonPath('settings.notes', 'Atualizado pelo teste.');

        $this->getJson('/api/settings?role=candidato&userId=3')
            ->assertOk()
            ->assertJsonPath('settings.emailDigest', false)
            ->assertJsonPath('settings.notes', 'Atualizado pelo teste.');
    }
}
