import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkPdfBlob, comparePdfText, expectedPdfText } from './pdfTextCheck';
import { loadPdfjs } from './resumeText';

vi.mock('./resumeText', () => ({ loadPdfjs: vi.fn() }));

const expected = { fields: [{ id: 'name', text: 'ليلى' }, { id: 'year', text: '2024' }] };
const blob = new Blob(['pdf'], { type: 'application/pdf' });

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('PDF selectable text check', () => {
  it('normalizes whitespace, NFC and bidi controls', () => {
    expect(comparePdfText('ليلى\u200f   2024', expected)).toEqual({ state: 'text_checked', missingFieldIds: [] });
    expect(comparePdfText('', expected)).toEqual({ state: 'unverified', missingFieldIds: ['name', 'year'] });
    expect(comparePdfText('ليلى', expected)).toEqual({ state: 'unverified', missingFieldIds: ['year'] });
  });

  it('accepts capitalization applied by the ATS template', () => {
    expect(comparePdfText('NORA EXAMPLE', { fields: [{ id: 'name', text: 'Nora Example' }] }))
      .toEqual({ state: 'text_checked', missingFieldIds: [] });
  });

  it('checks every visible block, including Arabic summary behind an English name', () => {
    const preview = document.createElement('div');
    preview.innerHTML = '<h1>Nora Example</h1><p>مهندسة برمجيات ٢٠٢٤.</p><ul><li>First bullet</li><li>Second bullet 25%.</li></ul><p>Diploma - Computing</p><p>SQL, TypeScript</p><a href="https://example.test">Portfolio label</a>';
    const captured = expectedPdfText({ basics: { name: 'Nora Example' } } as Parameters<typeof expectedPdfText>[0], preview);
    const complete = 'Nora Example مهندسة برمجيات ٢٠٢٤. First bullet Second bullet 25%. Diploma - Computing SQL, TypeScript Portfolio label';
    expect(comparePdfText(complete, captured).state).toBe('text_checked');
    for (const omitted of ['مهندسة برمجيات ٢٠٢٤.', 'Second bullet 25%.', 'Diploma - Computing', 'SQL, TypeScript', 'Portfolio label']) {
      expect(comparePdfText(complete.replace(omitted, ''), captured).state, omitted).toBe('unverified');
    }
  });

  it('excludes cleaned hidden, private and non-exported content without consulting resume fields', () => {
    const preview = document.createElement('div');
    preview.innerHTML = '<p>Visible fact</p>' + ['data-no-print', 'hidden', 'aria-hidden="true"', 'data-private', 'data-private-answer', 'style="display:none"', 'style="visibility:hidden"', 'style="opacity:0"'].map(attribute => `<p ${attribute}>Secret fact</p>`).join('');
    document.body.append(preview);
    try {
      expect(expectedPdfText({ basics: { name: 'Secret fact' } } as Parameters<typeof expectedPdfText>[0], preview)).toEqual({ fields: [{ id: 'preview.0', text: 'Visible fact' }] });
    } finally { preview.remove(); }
  });

  it.each(['\u0000', '\ufffd'])('rejects invalid extracted character %j even with all expected facts', invalid => {
    expect(comparePdfText(`ليلى 2024 ${invalid}`, expected).state).toBe('unverified');
  });

  it('preserves digit scripts and punctuation while accepting layout whitespace at scalar boundaries', () => {
    const captured = { fields: [{ id: 'fact', text: 'سَلَام SQL ٢٥٪ - ۲۰۲۴.' }] };
    expect(comparePdfText('س َ ل َ ام S Q L ٢ ٥ ٪ - ۲ ۰ ۲ ۴ .', captured).state).toBe('text_checked');
    for (const changed of ['سَلَام SQL 25٪ - ۲۰۲۴.', 'سَلَام SQL ٢٥٪ - 2024.', 'سَلَام SQL ٢٥٪ ۲۰۲۴.']) {
      expect(comparePdfText(changed, captured).state).toBe('unverified');
    }
  });

  it('checks page text and destroys PDF.js resources', async () => {
    const page = { getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'ليلى' }, { str: '2024' }] }), cleanup: vi.fn() };
    const pdf = { numPages: 1, getPage: vi.fn().mockResolvedValue(page), cleanup: vi.fn(), destroy: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(loadPdfjs).mockResolvedValue({ getDocument: () => ({ promise: Promise.resolve(pdf), destroy: vi.fn() }) } as never);
    expect(await checkPdfBlob(blob, expected)).toEqual({ state: 'text_checked', missingFieldIds: [] });
    expect(page.cleanup).toHaveBeenCalled();
    expect(pdf.destroy).toHaveBeenCalled();
  });

  it('leaves blank and over-limit files unverified', async () => {
    expect(await checkPdfBlob(new Blob(), expected)).toEqual({ state: 'unverified', missingFieldIds: ['name', 'year'] });
    const pdf = { numPages: 21, getPage: vi.fn(), cleanup: vi.fn(), destroy: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(loadPdfjs).mockResolvedValue({ getDocument: () => ({ promise: Promise.resolve(pdf), destroy: vi.fn() }) } as never);
    expect(await checkPdfBlob(blob, expected)).toEqual({ state: 'unverified', missingFieldIds: ['name', 'year'] });
    expect(pdf.getPage).not.toHaveBeenCalled();
  });

  it('marks an image-only PDF unverified', async () => {
    const pdf = { numPages: 1, getPage: vi.fn().mockResolvedValue({ getTextContent: () => Promise.resolve({ items: [] }) }), destroy: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(loadPdfjs).mockResolvedValue({ getDocument: () => ({ promise: Promise.resolve(pdf), destroy: vi.fn() }) } as never);
    expect(await checkPdfBlob(blob, expected)).toEqual({ state: 'unverified', missingFieldIds: ['name', 'year'] });
  });

  it('times out stalled extraction and destroys the task', async () => {
    vi.useFakeTimers();
    const destroy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(loadPdfjs).mockResolvedValue({ getDocument: () => ({ promise: new Promise(() => {}), destroy }) } as never);
    const result = checkPdfBlob(blob, expected);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await result).toEqual({ state: 'unverified', missingFieldIds: ['name', 'year'] });
    expect(destroy).toHaveBeenCalled();
  });
});
