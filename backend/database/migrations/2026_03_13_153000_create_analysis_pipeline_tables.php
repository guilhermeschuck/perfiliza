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
        Schema::create('analysis_runs', function (Blueprint $table): void {
            $table->id();
            $table->string('application_id')->index();
            $table->string('job_id')->nullable()->index();
            $table->string('candidate_id')->nullable()->index();
            $table->string('status')->default('pending')->index();
            $table->boolean('reprocess')->default(false);
            $table->string('trigger_source')->default('manual');
            $table->string('queue_connection')->nullable();
            $table->string('queue_name')->nullable();
            $table->string('model_name')->nullable();
            $table->string('prompt_version')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->text('error_message')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('resumes', function (Blueprint $table): void {
            $table->id();
            $table->string('candidate_id')->index();
            $table->string('application_id')->nullable()->index();
            $table->string('source')->default('candidate_profile');
            $table->string('file_name');
            $table->text('file_url')->nullable();
            $table->string('file_hash', 64)->nullable()->index();
            $table->string('mime')->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->timestamp('uploaded_at')->nullable();
            $table->timestamps();
        });

        Schema::create('analysis_reports', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('analysis_run_id')->constrained('analysis_runs')->cascadeOnDelete();
            $table->string('format')->default('json');
            $table->json('report_json')->nullable();
            $table->longText('report_markdown')->nullable();
            $table->text('report_pdf_url')->nullable();
            $table->timestamp('generated_at')->nullable();
            $table->timestamps();
        });

        Schema::create('resume_parses', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('resume_id')->constrained('resumes')->cascadeOnDelete();
            $table->foreignId('analysis_run_id')->nullable()->constrained('analysis_runs')->nullOnDelete();
            $table->string('parse_status')->default('pending')->index();
            $table->boolean('ocr_used')->default(false);
            $table->string('language', 12)->nullable();
            $table->longText('raw_text')->nullable();
            $table->json('normalized_json')->nullable();
            $table->json('confidence_json')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('parsed_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('resume_parses');
        Schema::dropIfExists('analysis_reports');
        Schema::dropIfExists('resumes');
        Schema::dropIfExists('analysis_runs');
    }
};
