<?php

return [
    'queue_enabled' => (bool) env('ANALYSIS_QUEUE_ENABLED', false),
    'queue_connection' => env('ANALYSIS_QUEUE_CONNECTION', env('QUEUE_CONNECTION', 'database')),
    'queue_name' => env('ANALYSIS_QUEUE_NAME', 'analysis'),
    'model_name' => env('ANALYSIS_MODEL_NAME', 'mock-analysis-v1'),
    'prompt_version' => env('ANALYSIS_PROMPT_VERSION', 'v1'),
    'ai_provider' => env('ANALYSIS_AI_PROVIDER', 'mock'),
    'ai_model' => env('ANALYSIS_AI_MODEL', 'gpt-4.1-mini'),
    'ai_max_retries' => max(0, (int) env('ANALYSIS_AI_MAX_RETRIES', 2)),
    'ai_timeout_seconds' => max(5, (int) env('ANALYSIS_AI_TIMEOUT_SECONDS', 20)),
    'ai_endpoint' => env('ANALYSIS_AI_ENDPOINT', 'https://api.openai.com/v1/chat/completions'),
    'ai_api_key' => env('OPENAI_API_KEY'),
    'ai_apply_score_hints' => (bool) env('ANALYSIS_AI_APPLY_SCORE_HINTS', false),
    'report_markdown_enabled' => (bool) env('ANALYSIS_REPORT_MARKDOWN_ENABLED', true),
    'raw_text_retention_days' => max(1, (int) env('ANALYSIS_RAW_TEXT_RETENTION_DAYS', 30)),
];
