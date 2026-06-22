// Scanned / image-only PDF OCR fallback.
//
// When deterministic text extraction (pdfjs + regex fallback) returns no
// selectable text, this helper sends the whole PDF to the existing multimodal
// model (Gemini 2.5 Flash via OpenRouter, file-parser `native` engine) which
// reads EVERY page natively, and returns the stitched transcription. It runs
// ONLY as a fallback — the fast selectable-text path is unchanged.
//
// Plain JS to match the surrounding netlify/lib/*.js modules. No new dependency.

import { callOpenRouter } from './openrouter-client.js';
import { parseAiJson } from './ai-contracts/json.js';
import { summarizeErrorForLog } from './sentry.js';

// Per-page JSON so the transcription is inherently page-delimited — the caller
// can prove (and we can count) that every page was processed, not just page 1.
const OCR_PAGES_SCHEMA = {
  type: 'object',
  properties: {
    pages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pageNumber: { type: 'number' },
          text: { type: 'string' },
        },
        required: ['pageNumber', 'text'],
      },
    },
  },
  required: ['pages'],
};

const OCR_SYSTEM = 'You are a precise OCR engine. Transcribe the document verbatim. Do not summarize, translate, reorder, infer, or add any content that is not visibly present.';

const OCR_INSTRUCTION = 'Transcribe EVERY page of this document. Return JSON of the form {"pages":[{"pageNumber":<n>,"text":"<verbatim text of that page>"}]}, with exactly one entry per page, in page order. Preserve line breaks within each page. Do not skip, merge, or omit any page.';

/**
 * OCR a PDF (or image) document via the vision model and return its full text.
 *
 * @param {{ base64Data: string, mime?: string, fileName?: string }} input
 * @param {{ maxTokens?: number, timeoutMs?: number }} [options]
 * @returns {Promise<{ text: string, pagesProcessed: number, source: 'ocr' }>}
 */
export async function extractScannedPdfText({ base64Data, mime, fileName } = {}, options = {}) {
  if (typeof base64Data !== 'string' || base64Data.length === 0) {
    return { text: '', pagesProcessed: 0, source: 'ocr' };
  }

  const mimeType = typeof mime === 'string' && mime.trim() ? mime.trim() : 'application/pdf';
  const dataUrl = `data:${mimeType};base64,${base64Data}`;

  const messages = [
    { role: 'system', content: OCR_SYSTEM },
    {
      role: 'user',
      content: [
        { type: 'text', text: OCR_INSTRUCTION },
        { type: 'file', file: { filename: fileName || 'document.pdf', file_data: dataUrl } },
      ],
    },
  ];

  console.log(`[OCR] Requesting transcription (${mimeType}, ${base64Data.length} b64 chars)`);

  // Provider error propagates — the caller (extract-resume-json) catches it and
  // falls back to the existing unreadable-file response.
  const raw = await callOpenRouter('flash', messages, OCR_PAGES_SCHEMA, {
    featureName: 'parse_resume_ocr',
    schemaName: 'resume_ocr_pages',
    plugins: [{ id: 'file-parser', pdf: { engine: 'native' } }],
    temperature: 0,
    maxTokens: options.maxTokens ?? 8192,
    timeoutMs: options.timeoutMs ?? 25000,
  });

  let parsed;
  try {
    parsed = parseAiJson(raw, 'parse_resume_ocr');
  } catch (error) {
    console.warn('[OCR] Failed to parse OCR JSON response:', summarizeErrorForLog(error));
    return { text: '', pagesProcessed: 0, source: 'ocr' };
  }

  const pages = Array.isArray(parsed?.pages) ? parsed.pages : [];
  const ordered = pages
    .filter((page) => page && typeof page.text === 'string' && page.text.trim().length > 0)
    .map((page, index) => ({
      pageNumber: Number.isFinite(Number(page.pageNumber)) ? Number(page.pageNumber) : index + 1,
      text: page.text.trim(),
    }))
    .sort((a, b) => a.pageNumber - b.pageNumber);

  const text = ordered.map((page) => `--- Page ${page.pageNumber} ---\n${page.text}`).join('\n\n');

  console.log(`[OCR] Transcribed ${ordered.length} page(s), ${text.length} chars`);
  return { text, pagesProcessed: ordered.length, source: 'ocr' };
}
