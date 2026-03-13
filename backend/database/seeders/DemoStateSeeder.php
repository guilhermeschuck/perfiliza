<?php

namespace Database\Seeders;

use App\Models\DemoState;
use Illuminate\Database\Seeder;
use JsonException;

class DemoStateSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DemoState::query()->updateOrCreate(
            ['key' => 'perfiliza_state'],
            ['payload' => $this->payload()],
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(): array
    {
        try {
            /** @var array<string, mixed> $payload */
            $payload = json_decode(
                file_get_contents(database_path('seeders/data/demo-data.json')) ?: '{}',
                true,
                512,
                JSON_THROW_ON_ERROR,
            );

            return $payload;
        } catch (JsonException) {
            return [];
        }
    }
}
