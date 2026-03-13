<?php

namespace App\Services;

use Illuminate\Support\Str;
use ZipArchive;

class ResumeTextExtractorService
{
    /**
     * @return array{rawText: string, ocrUsed: bool, engine: string, error: string|null}
     */
    public function extract(string $absolutePath, ?string $mime = null, ?string $fileName = null): array
    {
        $extension = Str::lower(pathinfo((string) ($fileName ?: $absolutePath), PATHINFO_EXTENSION));

        if ($extension === 'pdf') {
            $pdfText = $this->extractPdfText($absolutePath);

            if ($pdfText !== null && trim($pdfText) !== '') {
                return [
                    'rawText' => $this->sanitizeText($pdfText),
                    'ocrUsed' => false,
                    'engine' => 'pdftotext',
                    'error' => null,
                ];
            }

            $ocrText = $this->extractPdfWithOcr($absolutePath);

            if ($ocrText !== null && trim($ocrText) !== '') {
                return [
                    'rawText' => $this->sanitizeText($ocrText),
                    'ocrUsed' => true,
                    'engine' => 'tesseract',
                    'error' => null,
                ];
            }
        }

        if ($extension === 'docx') {
            $docxText = $this->extractDocxText($absolutePath);

            if ($docxText !== null && trim($docxText) !== '') {
                return [
                    'rawText' => $this->sanitizeText($docxText),
                    'ocrUsed' => false,
                    'engine' => 'docx-xml',
                    'error' => null,
                ];
            }
        }

        $fallbackText = $this->extractPlainTextFallback($absolutePath);

        if ($fallbackText !== null && trim($fallbackText) !== '') {
            return [
                'rawText' => $this->sanitizeText($fallbackText),
                'ocrUsed' => false,
                'engine' => 'plain-fallback',
                'error' => null,
            ];
        }

        return [
            'rawText' => '',
            'ocrUsed' => false,
            'engine' => 'none',
            'error' => 'Nao foi possivel extrair texto do arquivo de curriculo.',
        ];
    }

    private function extractPdfText(string $absolutePath): ?string
    {
        if (! $this->commandExists('pdftotext')) {
            return null;
        }

        $command = 'pdftotext -layout -nopgbrk '.escapeshellarg($absolutePath).' -';

        return $this->runShellCommand($command);
    }

    private function extractPdfWithOcr(string $absolutePath): ?string
    {
        if (! $this->commandExists('pdftoppm') || ! $this->commandExists('tesseract')) {
            return null;
        }

        $tmpDirectory = storage_path('app/tmp/ocr_'.Str::uuid()->toString());
        if (! is_dir($tmpDirectory) && ! @mkdir($tmpDirectory, 0775, true) && ! is_dir($tmpDirectory)) {
            return null;
        }

        $prefix = $tmpDirectory.'/page';
        $toPngCommand = 'pdftoppm -f 1 -l 3 -png '.escapeshellarg($absolutePath).' '.escapeshellarg($prefix);
        $conversionResult = $this->runShellCommand($toPngCommand);

        if ($conversionResult === null) {
            $this->deleteDirectory($tmpDirectory);

            return null;
        }

        $images = glob($prefix.'-*.png');
        if (! is_array($images) || $images === []) {
            $this->deleteDirectory($tmpDirectory);

            return null;
        }

        $chunks = [];

        foreach ($images as $imagePath) {
            $ocrCommand = 'tesseract '.escapeshellarg($imagePath).' stdout -l por+eng';
            $chunk = $this->runShellCommand($ocrCommand);

            if ($chunk !== null && trim($chunk) !== '') {
                $chunks[] = $chunk;
            }
        }

        $this->deleteDirectory($tmpDirectory);

        if ($chunks === []) {
            return null;
        }

        return implode("\n\n", $chunks);
    }

    private function extractDocxText(string $absolutePath): ?string
    {
        if (! class_exists(ZipArchive::class)) {
            return null;
        }

        $zip = new ZipArchive();
        $opened = $zip->open($absolutePath);

        if ($opened !== true) {
            return null;
        }

        $documentXml = $zip->getFromName('word/document.xml');
        $zip->close();

        if (! is_string($documentXml) || trim($documentXml) === '') {
            return null;
        }

        $text = strip_tags(str_replace(['</w:p>', '</w:tr>'], ["\n", "\n"], $documentXml));

        return trim($text) !== '' ? $text : null;
    }

    private function extractPlainTextFallback(string $absolutePath): ?string
    {
        $content = @file_get_contents($absolutePath);

        if (! is_string($content) || $content === '') {
            return null;
        }

        $utf8Content = @iconv('UTF-8', 'UTF-8//IGNORE', $content);
        $text = is_string($utf8Content) && $utf8Content !== '' ? $utf8Content : $content;
        $text = preg_replace('/[^\PC\s]/u', ' ', $text) ?: $text;
        $text = $this->sanitizeText($text);

        if ($text === '') {
            return null;
        }

        $letters = preg_match_all('/[a-zA-Z]/', $text);
        if (! is_int($letters) || $letters < 40) {
            return null;
        }

        return $text;
    }

    private function commandExists(string $command): bool
    {
        $result = @shell_exec('command -v '.$command.' 2>/dev/null');

        return is_string($result) && trim($result) !== '';
    }

    private function runShellCommand(string $command): ?string
    {
        $output = [];
        $exitCode = 1;

        @exec($command.' 2>/dev/null', $output, $exitCode);

        if ($exitCode !== 0) {
            return null;
        }

        return trim(implode("\n", $output));
    }

    private function sanitizeText(string $value): string
    {
        $normalized = str_replace(["\r\n", "\r"], "\n", $value);
        $normalized = preg_replace("/\n{3,}/", "\n\n", $normalized) ?: $normalized;
        $normalized = preg_replace('/[ \t]{2,}/', ' ', $normalized) ?: $normalized;

        return trim($normalized);
    }

    private function deleteDirectory(string $directory): void
    {
        if (! is_dir($directory)) {
            return;
        }

        $items = glob($directory.'/*');
        if (is_array($items)) {
            foreach ($items as $item) {
                if (is_file($item)) {
                    @unlink($item);
                }
            }
        }

        @rmdir($directory);
    }
}
