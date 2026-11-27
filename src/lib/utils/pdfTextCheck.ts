import type { ResumeSchema } from '@/types/resume';
import { loadPdfjs } from '@/lib/utils/resumeText';
import { captureTextPdfBlocks, cloneVisiblePdfPreview } from '@/lib/utils/textPdfSnapshot';

export interface ExpectedPdfText { fields: Array<{ id: string; text: string }> }
export type PdfTextCheckReason = 'reader_unavailable' | 'reader_error' | 'timeout' | 'corrupt' | 'raster_only' | 'empty_file' | 'page_limit' | 'empty_text' | 'invalid_text' | 'text_mismatch' | 'empty_expected';
export type PdfTextCheck = { state: 'text_checked' | 'unverified'; missingFieldIds: string[]; reason?: PdfTextCheckReason };

// PDF.js may insert layout whitespace between scripts, punctuation and combining marks.
const normalize = (text: string) => text
  .replace(/[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/g, '')
  .replace(/\s+/gu, '').normalize('NFC').toLowerCase();

export function comparePdfText(extracted: string, expected: ExpectedPdfText): PdfTextCheck {
  if (extracted.includes('\u0000') || extracted.includes('\ufffd')) {
    return { state: 'unverified', reason: 'invalid_text', missingFieldIds: expected.fields.map(field => field.id) };
  }
  const text = normalize(extracted);
  const missingFieldIds = expected.fields.filter(field => !text.includes(normalize(field.text))).map(field => field.id);
  if (text && expected.fields.length > 0 && missingFieldIds.length === 0) return { state: 'text_checked', missingFieldIds };
  return { state: 'unverified', reason: !text ? 'empty_text' : !expected.fields.length ? 'empty_expected' : 'text_mismatch', missingFieldIds };
}

export function expectedPdfText(_resume: ResumeSchema, preview: HTMLElement): ExpectedPdfText {
  const blocks = captureTextPdfBlocks(cloneVisiblePdfPreview(preview));
  return { fields: blocks.map((block, index) => ({
    id: `preview.${index}`, text: block.runs.map(run => run.text).join(''),
  })) };
}

export async function checkPdfBlob(blob: Blob, expected: ExpectedPdfText): Promise<PdfTextCheck> {
  const unverified = (reason: PdfTextCheckReason): PdfTextCheck => ({ state: 'unverified', reason, missingFieldIds: expected.fields.map(field => field.id) });
  if (!blob.size) return unverified('empty_file');
  type PdfTask = ReturnType<NonNullable<Awaited<ReturnType<typeof loadPdfjs>>>['getDocument']>;
  let task: PdfTask | undefined;
  let document: Awaited<PdfTask['promise']> | undefined;
  let timer: ReturnType<typeof setTimeout>;
  let stopped = false;
  let timedOut = false;
  // Includes cold PDF.js/worker startup as well as extraction; five seconds
  // rejected intact English exports on the first check of a new document.
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { timedOut = true; reject(new Error('PDF_TEXT_CHECK_TIMEOUT')); }, 30000); });
  try {
    const check = async () => {
      const pdfjs = await loadPdfjs();
      if (!pdfjs) return unverified('reader_unavailable');
      if (stopped) return unverified('timeout');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (stopped) return unverified('timeout');
      task = pdfjs.getDocument({ data: bytes, isEvalSupported: false });
      document = await task.promise;
      if (stopped) return unverified('timeout');
      if (document.numPages > 20) return unverified('page_limit');
      const parts: string[] = [];
      let hasImage = false;
      let visible: boolean | undefined;
      for (let number = 1; number <= document.numPages; number += 1) {
        if (stopped) return unverified('timeout');
        const page = await document.getPage(number);
        try {
          // A PDF can contain perfectly extractable white text, or a white raster.
          // Check a bounded thumbnail until one page actually shows ink.
          if (!visible && document.canvasFactory) {
            const unit = page.getViewport({ scale: 1 });
            const viewport = page.getViewport({ scale: 384 / Math.max(unit.width, unit.height) });
            const surface = document.canvasFactory.create(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
            try {
              await page.render({ canvasContext: surface.context, viewport, background: '#fff' }).promise;
              const pixels = surface.context.getImageData(0, 0, surface.canvas.width, surface.canvas.height).data;
              visible = false;
              for (let i = 0; i < pixels.length; i += 4) {
                if (pixels[i + 3] && Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 250) {
                  visible = true;
                  break;
                }
              }
            } finally { document.canvasFactory.destroy(surface); }
          }
          const text = (await page.getTextContent()).items.map(item => item.str ?? '').join(' ');
          parts.push(text);
          if (!text.trim() && !hasImage) {
            const operators = await page.getOperatorList();
            const imageOperators = Object.entries(pdfjs.OPS).filter(([name]) => /^paint(?:Inline)?Image/.test(name)).map(([, value]) => value);
            hasImage = operators.fnArray.some((op: number) => imageOperators.includes(op));
          }
        }
        finally { page.cleanup?.(); }
      }
      if (visible === false) return unverified('empty_text');
      if (parts.every(part => !part.trim())) {
        if (hasImage) return unverified('raster_only');
        if (visible) return unverified('invalid_text');
      }
      return comparePdfText(parts.join(' '), expected);
    };
    return await Promise.race([check(), timeout]);
  } catch (error) {
    if (error instanceof Error && error.name === 'InvalidPDFException') return unverified('corrupt');
    return unverified(timedOut ? 'timeout' : 'reader_error');
  } finally {
    stopped = true;
    clearTimeout(timer!);
    document?.cleanup?.();
    void (document?.destroy() ?? task?.destroy())?.catch(() => undefined);
  }
}
