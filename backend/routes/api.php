<?php

use App\Http\Controllers\Api\Admin\ApplicationsController as AdminApplicationsController;
use App\Http\Controllers\Api\Admin\AnalysisRunsController as AdminAnalysisRunsController;
use App\Http\Controllers\Api\Admin\AnalysisRunReviewsController as AdminAnalysisRunReviewsController;
use App\Http\Controllers\Api\Admin\JobsController as AdminJobsController;
use App\Http\Controllers\Api\Admin\OverviewController as AdminOverviewController;
use App\Http\Controllers\Api\Admin\TokenPricingController as AdminTokenPricingController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BootstrapController;
use App\Http\Controllers\Api\CandidateController;
use App\Http\Controllers\Api\CompanyReportsController;
use App\Http\Controllers\Api\CompanyTokensController;
use App\Http\Controllers\Api\JobsController;
use App\Http\Controllers\Api\PublicJobsController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\SubmissionsController;
use Illuminate\Support\Facades\Route;

Route::get('/bootstrap', BootstrapController::class);

Route::prefix('admin')->group(function (): void {
    Route::get('/companies', [AdminOverviewController::class, 'companies']);
    Route::get('/candidates', [AdminOverviewController::class, 'candidates']);
    Route::get('/analyses/ia-metrics', [AdminOverviewController::class, 'iaMetrics']);
    Route::get('/token-pricing', [AdminTokenPricingController::class, 'show']);
    Route::patch('/token-pricing', [AdminTokenPricingController::class, 'update']);

    Route::post('/jobs', [AdminJobsController::class, 'store']);
    Route::patch('/jobs/{jobId}', [AdminJobsController::class, 'update']);
    Route::delete('/jobs/{jobId}', [AdminJobsController::class, 'destroy']);
    Route::patch('/jobs/{jobId}/status', [AdminJobsController::class, 'updateStatus']);
    Route::get('/jobs/{jobId}/candidates', [AdminJobsController::class, 'candidates']);

    Route::get('/applications/{applicationId}/analysis', [AdminApplicationsController::class, 'analysis']);
    Route::get('/applications/{applicationId}/analysis/export', [AdminApplicationsController::class, 'export']);
    Route::post('/applications/{applicationId}/analysis/start', [AdminApplicationsController::class, 'start']);
    Route::post('/applications/{applicationId}/analysis/reprocess', [AdminApplicationsController::class, 'reprocess']);
    Route::get('/analysis-runs/{analysisRunId}', [AdminAnalysisRunsController::class, 'show']);
    Route::get('/analysis-runs/{analysisRunId}/events', [AdminAnalysisRunsController::class, 'events']);
    Route::get('/analysis-runs/{analysisRunId}/review', [AdminAnalysisRunReviewsController::class, 'show']);
    Route::post('/analysis-runs/{analysisRunId}/review', [AdminAnalysisRunReviewsController::class, 'store']);
});

Route::prefix('company/reports')->group(function (): void {
    Route::get('/overview', [CompanyReportsController::class, 'overview']);
    Route::get('/funnel', [CompanyReportsController::class, 'funnel']);
    Route::get('/sources', [CompanyReportsController::class, 'sources']);
    Route::get('/hiring-time', [CompanyReportsController::class, 'hiringTime']);
});

Route::prefix('company/tokens')->group(function (): void {
    Route::get('/', [CompanyTokensController::class, 'show']);
    Route::post('/purchase', [CompanyTokensController::class, 'purchase']);
    Route::post('/consume', [CompanyTokensController::class, 'consume']);
    Route::get('/transactions', [CompanyTokensController::class, 'transactions']);
});

Route::prefix('candidate')->group(function (): void {
    Route::get('/notifications', [CandidateController::class, 'notifications']);
    Route::post('/notifications/{notificationId}/read', [CandidateController::class, 'markNotificationRead']);
    Route::get('/saved-jobs', [CandidateController::class, 'savedJobs']);
    Route::post('/saved-jobs', [CandidateController::class, 'storeSavedJob']);
    Route::delete('/saved-jobs/{jobId}', [CandidateController::class, 'destroySavedJob']);

    Route::get('/profile', [CandidateController::class, 'profile']);
    Route::patch('/profile', [CandidateController::class, 'updateProfile']);
    Route::get('/profile/resume', [CandidateController::class, 'resume']);
    Route::post('/profile/resume', [CandidateController::class, 'storeResume']);
    Route::delete('/profile/resume', [CandidateController::class, 'destroyResume']);
    Route::post('/applications/{applicationId}/withdraw', [CandidateController::class, 'withdrawApplication']);
});

Route::post('/auth/login', [AuthController::class, 'login']);
Route::get('/settings', [SettingsController::class, 'show']);
Route::patch('/settings', [SettingsController::class, 'update']);

Route::get('/public/jobs/{shareToken}', [PublicJobsController::class, 'show']);
Route::post('/public/jobs/{shareToken}/leads', [PublicJobsController::class, 'storeLead']);

Route::patch('/jobs/{jobId}/public-form', [JobsController::class, 'updatePublicForm']);
Route::post('/jobs/{jobId}/leads/{leadId}/submit', [JobsController::class, 'submitLead']);

Route::post('/submissions', [SubmissionsController::class, 'store']);
