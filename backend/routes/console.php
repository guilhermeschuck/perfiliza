<?php

use App\Services\ResumeDataRetentionService;
use App\Services\DemoStateService;
use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('analysis:cleanup-sensitive-data {--days=}', function (ResumeDataRetentionService $retentionService): void {
    $daysOption = $this->option('days');
    $days = is_numeric($daysOption) ? (int) $daysOption : null;
    $result = $retentionService->purgeRawText($days);

    $this->info('Cleanup concluido.');
    $this->line('Retention days: '.$result['retentionDays']);
    $this->line('Cutoff: '.$result['cutoff']);
    $this->line('Redacted resumes: '.$result['redactedCount']);
    $this->line('Runs touched: '.count((array) ($result['runsTouched'] ?? [])));
})->purpose('Redige texto bruto de curriculos conforme politica de retencao');

Schedule::command('analysis:cleanup-sensitive-data')->dailyAt('03:30');

Artisan::command(
    'app:create-user {name} {email} {role : admin|empresa|candidato} {--password=} {--company=}',
    function (DemoStateService $demoStateService): int {
        $name = trim((string) $this->argument('name'));
        $email = strtolower(trim((string) $this->argument('email')));
        $role = trim((string) $this->argument('role'));
        $passwordOption = $this->option('password');
        $password = is_string($passwordOption) ? trim($passwordOption) : '';
        $companyOption = $this->option('company');
        $company = is_string($companyOption) ? trim($companyOption) : '';

        if (! in_array($role, ['admin', 'empresa', 'candidato'], true)) {
            $this->error('Role invalido. Use: admin, empresa ou candidato.');
            return 1;
        }

        if ($name === '') {
            $this->error('Nome nao pode ser vazio.');
            return 1;
        }

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error('Email invalido.');
            return 1;
        }

        if ($password === '') {
            $password = (string) $this->secret('Senha (minimo 8 caracteres)');
        }

        if (strlen($password) < 8) {
            $this->error('Senha deve ter no minimo 8 caracteres.');
            return 1;
        }

        if ($role === 'empresa' && $company === '') {
            $company = (string) $this->ask('Nome da empresa', $name);
        }

        $user = User::query()->updateOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'role' => $role,
                'company' => $role === 'empresa' ? $company : null,
                'password' => Hash::make($password),
            ],
        );

        $demoStateService->synchronizeUserFromAccount($user);

        $this->info('Usuario salvo com sucesso.');
        $this->line('ID: '.$user->id);
        $this->line('Email: '.$email);
        $this->line('Role: '.$role);
        if ($role === 'empresa') {
            $this->line('Empresa: '.$company);
        }

        return 0;
    }
)->purpose('Cria ou atualiza usuario de acesso real (admin|empresa|candidato).');

Artisan::command('app:reset-state', function (DemoStateService $demoStateService): int {
    $demoStateService->resetState();
    $this->info('Estado da aplicacao resetado para base vazia.');
    return 0;
})->purpose('Reseta o estado operacional (jobs, candidatos, candidaturas, analises).');
