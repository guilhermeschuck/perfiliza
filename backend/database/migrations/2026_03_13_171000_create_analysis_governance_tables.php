<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('candidate_profiles_ai', function (Blueprint $table): void {
            $table->id();
            $table->string('candidate_id')->unique();
            $table->foreignId('analysis_run_id')->nullable()->constrained('analysis_runs')->nullOnDelete();
            $table->foreignId('resume_parse_id')->nullable()->constrained('resume_parses')->nullOnDelete();
            $table->string('profile_version')->default('v1');
            $table->json('profile_json')->nullable();
            $table->json('confidence_json')->nullable();
            $table->string('updated_by')->default('pipeline');
            $table->timestamp('generated_at')->nullable();
            $table->timestamps();
        });

        Schema::create('analysis_scores', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('analysis_run_id')->constrained('analysis_runs')->cascadeOnDelete();
            $table->string('application_id')->index();
            $table->string('candidate_id')->nullable()->index();
            $table->string('job_id')->nullable()->index();
            $table->unsignedSmallInteger('overall_score')->nullable();
            $table->unsignedSmallInteger('compatibility_score')->nullable();
            $table->unsignedSmallInteger('consistency_score')->nullable();
            $table->json('dimensions_json')->nullable();
            $table->json('weights_json')->nullable();
            $table->json('adjustments_json')->nullable();
            $table->json('signals_json')->nullable();
            $table->timestamp('calculated_at')->nullable();
            $table->timestamps();

            $table->unique('analysis_run_id');
        });

        Schema::create('analysis_audit_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('analysis_run_id')->nullable()->constrained('analysis_runs')->nullOnDelete();
            $table->string('application_id')->nullable()->index();
            $table->string('candidate_id')->nullable()->index();
            $table->string('job_id')->nullable()->index();
            $table->string('stage')->index();
            $table->string('level')->default('info')->index();
            $table->string('event_key')->nullable()->index();
            $table->text('message')->nullable();
            $table->json('context_json')->nullable();
            $table->string('lgpd_purpose')->nullable();
            $table->string('lgpd_legal_basis')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->timestamp('happened_at')->nullable()->index();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('analysis_audit_logs');
        Schema::dropIfExists('analysis_scores');
        Schema::dropIfExists('candidate_profiles_ai');
    }
};
