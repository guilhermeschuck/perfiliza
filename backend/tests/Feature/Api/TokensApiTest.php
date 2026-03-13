<?php

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TokensApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_company_can_purchase_and_list_tokens(): void
    {
        $walletResponse = $this->getJson('/api/company/tokens?companyId=2')
            ->assertOk()
            ->assertJsonStructure([
                'companyId',
                'pricing',
                'actions',
                'wallet' => ['companyId', 'balance', 'purchased', 'spent'],
                'transactions',
            ]);

        $initialBalance = (int) $walletResponse->json('wallet.balance');

        $purchaseResponse = $this->postJson('/api/company/tokens/purchase', [
            'companyId' => '2',
            'tokens' => 75,
            'note' => 'Pacote de teste',
        ]);

        $purchaseResponse
            ->assertCreated()
            ->assertJsonPath('companyId', '2')
            ->assertJsonPath('tokensAdded', 75)
            ->assertJsonPath('wallet.balance', $initialBalance + 75);

        $this->getJson('/api/company/tokens/transactions?companyId=2&limit=5')
            ->assertOk()
            ->assertJsonPath('transactions.0.action', 'token_purchase');
    }

    public function test_job_creation_is_blocked_when_balance_is_insufficient(): void
    {
        $this->patchJson('/api/admin/token-pricing', [
            'pricing' => [
                'campaign_create' => 200,
            ],
        ])->assertOk()->assertJsonPath('pricing.campaign_create', 200);

        $this->postJson('/api/admin/jobs', [
            'companyId' => '2',
            'title' => 'Head de Produto',
            'department' => 'Produto',
            'location' => 'Sao Paulo, SP',
            'type' => 'CLT',
            'level' => 'Pleno',
            'description' => 'Responsavel pela estrategia e execucao do produto.',
            'requirements' => ['Roadmap', 'Discovery'],
            'benefits' => ['Plano de saude'],
            'status' => 'active',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('tokens');
    }

    public function test_analysis_start_and_reprocess_consume_tokens(): void
    {
        $this->patchJson('/api/admin/token-pricing', [
            'pricing' => [
                'resume_analysis_start' => 11,
                'resume_analysis_reprocess' => 7,
            ],
        ])->assertOk();

        $initialWalletResponse = $this->getJson('/api/company/tokens?companyId=2')
            ->assertOk();
        $initialBalance = (int) $initialWalletResponse->json('wallet.balance');

        $this->postJson('/api/admin/applications/1/analysis/start')
            ->assertOk();

        $afterStartWalletResponse = $this->getJson('/api/company/tokens?companyId=2')
            ->assertOk();
        $afterStartBalance = (int) $afterStartWalletResponse->json('wallet.balance');

        $this->assertSame($initialBalance - 11, $afterStartBalance);

        $this->postJson('/api/admin/applications/1/analysis/reprocess')
            ->assertOk();

        $afterReprocessWalletResponse = $this->getJson('/api/company/tokens?companyId=2')
            ->assertOk();
        $afterReprocessBalance = (int) $afterReprocessWalletResponse->json('wallet.balance');

        $this->assertSame($afterStartBalance - 7, $afterReprocessBalance);
    }
}
