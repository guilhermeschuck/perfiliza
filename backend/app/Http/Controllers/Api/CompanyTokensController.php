<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Company\ConsumeTokensRequest;
use App\Http\Requests\Company\PurchaseTokensRequest;
use App\Services\DemoStateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CompanyTokensController extends Controller
{
    public function show(Request $request, DemoStateService $demoStateService): JsonResponse
    {
        $validated = $request->validate([
            'companyId' => ['required', 'string'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        return response()->json(
            $demoStateService->companyTokens(
                (string) $validated['companyId'],
                (int) ($validated['limit'] ?? 20),
            )
        );
    }

    public function purchase(PurchaseTokensRequest $request, DemoStateService $demoStateService): JsonResponse
    {
        $validated = $request->validated();

        return response()->json(
            $demoStateService->purchaseCompanyTokens(
                (string) $validated['companyId'],
                (int) $validated['tokens'],
                isset($validated['note']) ? (string) $validated['note'] : null,
            ),
            201,
        );
    }

    public function consume(ConsumeTokensRequest $request, DemoStateService $demoStateService): JsonResponse
    {
        $validated = $request->validated();
        $metadata = is_array($validated['metadata'] ?? null) ? $validated['metadata'] : [];

        if (isset($validated['description'])) {
            $metadata['description'] = (string) $validated['description'];
        }

        return response()->json(
            $demoStateService->consumeCompanyTokens(
                (string) $validated['companyId'],
                (string) $validated['action'],
                $metadata,
            )
        );
    }

    public function transactions(Request $request, DemoStateService $demoStateService): JsonResponse
    {
        $validated = $request->validate([
            'companyId' => ['required', 'string'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        return response()->json(
            $demoStateService->companyTokenTransactions(
                (string) $validated['companyId'],
                (int) ($validated['limit'] ?? 20),
            )
        );
    }
}
