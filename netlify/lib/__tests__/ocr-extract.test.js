import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Part 1 — Diagnosis: prove the failure class.
// A 2-page image-only PDF (no text operators) yields NO selectable text from the
// deterministic extractor, so classifyExtraction reports "empty". This is why a
// prompt-only fix cannot work — there is nothing to read without OCR.
// ---------------------------------------------------------------------------
import { extractPlainTextFromArrayBuffer, classifyExtraction } from '../resumeText.js';

describe('scanned-PDF diagnosis (no selectable text)', () => {
  it('extracts no readable text from a 2-page image-only PDF', async () => {
    const bytes = readFileSync(join(__dirname, 'fixtures', 'two-page-no-text.pdf'));
    const text = await extractPlainTextFromArrayBuffer(bytes, {
      mimeType: 'application/pdf',
      fileName: 'two-page-no-text.pdf',
    });
    // The whole point: deterministic extraction cannot recover this content.
    expect(classifyExtraction(text)).toBe('empty');
    expect(text.length).toBeLessThan(100);
  });
});

// ---------------------------------------------------------------------------
// Part 2 — OCR helper boundary: it must call the provider with the PDF as a
// multimodal file part and STITCH every returned page (not just page 1).
// Only the provider call (callOpenRouter) is mocked.
// ---------------------------------------------------------------------------
const mockCallOpenRouter = vi.fn();
vi.mock('../openrouter-client.js', () => ({
  callOpenRouter: (...args) => mockCallOpenRouter(...args),
}));

const { extractScannedPdfText } = await import('../ocr-extract.js');

describe('extractScannedPdfText', () => {
  beforeEach(() => {
    mockCallOpenRouter.mockReset();
  });

  it('stitches every page returned by the OCR provider and reports pagesProcessed', async () => {
    mockCallOpenRouter.mockResolvedValue(
      JSON.stringify({
        pages: [
          { pageNumber: 1, text: 'ABDULLAH BIN AHMED\nLead Technical Support & Integrations Engineer' },
          { pageNumber: 2, text: 'Automated Application Support Bot\nArabic: Native' },
        ],
      }),
    );

    const result = await extractScannedPdfText({
      base64Data: Buffer.from('fake-pdf').toString('base64'),
      mime: 'application/pdf',
      fileName: 'resume.pdf',
    });

    // Provider was asked to read a PDF file part (multimodal content array).
    expect(mockCallOpenRouter).toHaveBeenCalledTimes(1);
    const [, messages] = mockCallOpenRouter.mock.calls[0];
    const userMsg = messages.find((m) => m.role === 'user');
    expect(Array.isArray(userMsg.content)).toBe(true);
    const filePart = userMsg.content.find((p) => p.type === 'file');
    expect(filePart.file.file_data).toContain('data:application/pdf;base64,');

    // Both pages are stitched into the result — page 2 is NOT dropped.
    expect(result.text).toContain('Lead Technical Support & Integrations Engineer');
    expect(result.text).toContain('Automated Application Support Bot');
    expect(result.pagesProcessed).toBe(2);
    expect(result.source).toBe('ocr');
  });

  it('returns empty text when the provider yields no pages', async () => {
    mockCallOpenRouter.mockResolvedValue(JSON.stringify({ pages: [] }));
    const result = await extractScannedPdfText({
      base64Data: Buffer.from('fake-pdf').toString('base64'),
      mime: 'application/pdf',
      fileName: 'resume.pdf',
    });
    expect(result.text).toBe('');
    expect(result.pagesProcessed).toBe(0);
  });
});
