import type { ResumeSchema } from '@/types/resume';
import { loadPdfjs } from '@/lib/utils/resumeText';

export interface ExpectedPdfText { fields: Array<{ id: string; text: string }> }
export type PdfTextCheck = { state: 'text_checked' | 'unverified'; missingFieldIds: string[] };

const normalize = (text: string) => text.normalize('NFC')
  .replace(/[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/g, '')
  .replace(/[\u0660-\u0669\u06f0-\u06f9]/g, digit => String('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹'.indexOf(digit) % 10))
  .replace(/\s+/g, ' ').trim().toLowerCase();

export function comparePdfText(extracted: string, expected: ExpectedPdfText): PdfTextCheck {
  const text = normalize(extracted);
  const missingFieldIds = expected.fields.filter(field => !text.includes(normalize(field.text))).map(field => field.id);
  return { state: text && expected.fields.length > 0 && missingFieldIds.length === 0 ? 'text_checked' : 'unverified', missingFieldIds };
}

export function expectedPdfText(resume: ResumeSchema, preview: HTMLElement): ExpectedPdfText {
  const captured = preview.cloneNode(true) as HTMLElement;
  captured.querySelectorAll('[data-no-print], [hidden], [aria-hidden="true"]').forEach(element => element.remove());
  const visible = normalize(captured.textContent ?? '');
  const fields: ExpectedPdfText['fields'] = [];
  const add = (id: string, text?: string) => {
    if (text && visible.includes(normalize(text))) fields.push({ id, text });
  };
  add('name', resume.basics?.name);
  add('email', resume.basics?.email);
  add('phone', resume.basics?.phone);
  resume.work?.forEach((job, index) => {
    add(`work.${index}.name`, job.name);
    add(`work.${index}.startDate`, job.startDate);
    add(`work.${index}.endDate`, job.endDate);
    add(`work.${index}.highlight`, job.highlights?.map(text => text.replace(/^\s*(?:[•·*\-–—]\s+)+/, '').trim())
      .find(text => visible.includes(normalize(text))));
  });
  return { fields };
}

export async function checkPdfBlob(blob: Blob, expected: ExpectedPdfText): Promise<PdfTextCheck> {
  const unverified: PdfTextCheck = { state: 'unverified', missingFieldIds: expected.fields.map(field => field.id) };
  if (!blob.size) return unverified;
  type PdfTask = ReturnType<NonNullable<Awaited<ReturnType<typeof loadPdfjs>>>['getDocument']>;
  let task: PdfTask | undefined;
  let document: Awaited<PdfTask['promise']> | undefined;
  let timer: ReturnType<typeof setTimeout>;
  let stopped = false;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('PDF_TEXT_CHECK_TIMEOUT')), 5000); });
  try {
    const check = async () => {
      const pdfjs = await loadPdfjs();
      if (!pdfjs || stopped) return unverified;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (stopped) return unverified;
      task = pdfjs.getDocument({ data: bytes, disableWorker: true, isEvalSupported: false });
      document = await task.promise;
      if (stopped || document.numPages > 20) return unverified;
      const parts: string[] = [];
      for (let number = 1; number <= document.numPages; number += 1) {
        if (stopped) return unverified;
        const page = await document.getPage(number);
        try { parts.push((await page.getTextContent()).items.map(item => item.str ?? '').join(' ')); }
        finally { page.cleanup?.(); }
      }
      return comparePdfText(parts.join(' '), expected);
    };
    return await Promise.race([check(), timeout]);
  } catch {
    return unverified;
  } finally {
    stopped = true;
    clearTimeout(timer!);
    document?.cleanup?.();
    void (document?.destroy() ?? task?.destroy())?.catch(() => undefined);
  }
}
