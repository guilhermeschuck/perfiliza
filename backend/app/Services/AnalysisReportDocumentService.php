<?php

namespace App\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

class AnalysisReportDocumentService
{
    /**
     * @return array<string, mixed>
     */
    public function generatePdfReport(int $analysisRunId, string $reportMarkdown): array
    {
        $trimmed = trim($reportMarkdown);

        if ($trimmed === '') {
            return [
                'status' => 'skipped',
                'reason' => 'empty_report_markdown',
                'reportPdfUrl' => null,
                'reportPdfPath' => null,
            ];
        }

        try {
            $plainText = $this->markdownToText($trimmed);
            $pages = $this->paginateText($plainText);
            $pdfBinary = $this->buildSimplePdf($pages);
            $fileName = 'analysis-run-'.$analysisRunId.'-'.Carbon::now()->format('YmdHis').'.pdf';
            $storagePath = 'analysis-reports/'.$fileName;

            Storage::disk('public')->put($storagePath, $pdfBinary);

            return [
                'status' => 'completed',
                'reportPdfUrl' => Storage::disk('public')->url($storagePath),
                'reportPdfPath' => $storagePath,
            ];
        } catch (\Throwable $exception) {
            return [
                'status' => 'failed',
                'reason' => 'pdf_generation_failed',
                'error' => $exception->getMessage(),
                'reportPdfUrl' => null,
                'reportPdfPath' => null,
            ];
        }
    }

    private function markdownToText(string $markdown): string
    {
        $lines = explode("\n", $markdown);

        $normalized = collect($lines)
            ->map(function (string $line): string {
                $line = str_replace(["\t", "\r"], [' ', ''], $line);
                $line = preg_replace('/^#{1,6}\s*/', '', $line) ?? $line;
                $line = preg_replace('/^\-\s*/', '- ', $line) ?? $line;
                $line = preg_replace('/\*\*(.*?)\*\*/', '$1', $line) ?? $line;
                $line = preg_replace('/\*(.*?)\*/', '$1', $line) ?? $line;
                $line = preg_replace('/`(.*?)`/', '$1', $line) ?? $line;

                return rtrim($line);
            })
            ->all();

        return implode("\n", $normalized);
    }

    /**
     * @return array<int, array<int, string>>
     */
    private function paginateText(string $plainText): array
    {
        $maxCharsPerLine = 95;
        $maxLinesPerPage = 48;
        $wrappedLines = [];

        foreach (explode("\n", $plainText) as $line) {
            $normalized = $this->toPdfSafeText($line);
            $chunks = explode("\n", wordwrap($normalized, $maxCharsPerLine, "\n", true));

            foreach ($chunks as $chunk) {
                $wrappedLines[] = $chunk;
            }
        }

        if ($wrappedLines === []) {
            $wrappedLines[] = '';
        }

        return collect($wrappedLines)
            ->chunk($maxLinesPerPage)
            ->map(fn ($chunk): array => $chunk->values()->all())
            ->values()
            ->all();
    }

    private function toPdfSafeText(string $text): string
    {
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
        $ascii = is_string($ascii) ? $ascii : $text;
        $ascii = preg_replace('/[^\x20-\x7E]/', '', $ascii) ?? '';

        return trim($ascii);
    }

    /**
     * @param  array<int, array<int, string>>  $pages
     */
    private function buildSimplePdf(array $pages): string
    {
        $objects = [];
        $objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        $kids = [];

        $nextObjectId = 3;
        $pageMap = [];

        foreach ($pages as $lines) {
            $pageObjectId = $nextObjectId++;
            $contentObjectId = $nextObjectId++;
            $kids[] = $pageObjectId.' 0 R';
            $pageMap[] = [
                'pageObjectId' => $pageObjectId,
                'contentObjectId' => $contentObjectId,
                'lines' => $lines,
            ];
        }

        $fontObjectId = $nextObjectId++;
        $objects[2] = '<< /Type /Pages /Count '.count($pageMap).' /Kids ['.implode(' ', $kids).'] >>';
        $objects[$fontObjectId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

        foreach ($pageMap as $page) {
            $stream = $this->buildPageTextStream($page['lines']);
            $objects[$page['contentObjectId']] = "<< /Length ".strlen($stream)." >>\nstream\n".$stream."\nendstream";
            $objects[$page['pageObjectId']] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] '
                .'/Resources << /Font << /F1 '.$fontObjectId.' 0 R >> >> '
                .'/Contents '.$page['contentObjectId'].' 0 R >>';
        }

        ksort($objects);
        $pdf = "%PDF-1.4\n";
        $offsets = [];
        $maxObjectId = (int) max(array_keys($objects));

        foreach ($objects as $id => $content) {
            $offsets[$id] = strlen($pdf);
            $pdf .= $id." 0 obj\n".$content."\nendobj\n";
        }

        $xrefPosition = strlen($pdf);
        $pdf .= "xref\n0 ".($maxObjectId + 1)."\n";
        $pdf .= "0000000000 65535 f \n";

        for ($id = 1; $id <= $maxObjectId; $id++) {
            $offset = (int) ($offsets[$id] ?? 0);
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }

        $pdf .= "trailer\n<< /Size ".($maxObjectId + 1)." /Root 1 0 R >>\n";
        $pdf .= "startxref\n".$xrefPosition."\n%%EOF";

        return $pdf;
    }

    /**
     * @param  array<int, string>  $lines
     */
    private function buildPageTextStream(array $lines): string
    {
        $commands = [
            'BT',
            '/F1 10 Tf',
            '14 TL',
            '50 790 Td',
        ];

        foreach ($lines as $index => $line) {
            if ($index > 0) {
                $commands[] = 'T*';
            }

            $escaped = $this->escapePdfText((string) $line);
            $commands[] = '('.$escaped.') Tj';
        }

        $commands[] = 'ET';

        return implode("\n", $commands);
    }

    private function escapePdfText(string $text): string
    {
        $escaped = str_replace('\\', '\\\\', $text);
        $escaped = str_replace('(', '\\(', $escaped);

        return str_replace(')', '\\)', $escaped);
    }
}
