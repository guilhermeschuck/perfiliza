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
        Schema::create('analysis_review_decisions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('analysis_run_id')->constrained('analysis_runs')->cascadeOnDelete();
            $table->string('application_id')->index();
            $table->string('candidate_id')->nullable()->index();
            $table->string('job_id')->nullable()->index();
            $table->string('reviewer_id')->index();
            $table->string('decision')->index();
            $table->text('rationale');
            $table->json('tags_json')->nullable();
            $table->timestamp('decided_at')->nullable()->index();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('analysis_review_decisions');
    }
};
