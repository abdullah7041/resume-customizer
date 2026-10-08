import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkPdfBlob, comparePdfText, expectedPdfText } from './pdfTextCheck';
import { loadPdfjs } from './resumeText';

vi.mock('./resumeText', () => ({ loadPdfjs: vi.fn() }));

const expected = { fields: [{ id: 'name', text: 'ليلى' }, { id: 'year', text: '2024' }] };
const blob = new Blob(['pdf'], { type: 'application/pdf' });

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('PDF selectable text check', () => {
  it('normalizes Arabic digits, whitespace, NFC and bidi controls', () => {
    expect(comparePdfText('ليلى\u200f   ٢٠٢٤', expected)).toEqual({ state: 'text_checked', missingFieldIds: [] });
    expect(comparePdfText('', expected)).toEqual({ state: 'unverified', missingFieldIds: ['name', 'year'] });
    expect(comparePdfText('ليلى', expected)).toEqual({ state: 'unverified', missingFieldIds: ['year'] });
  });

  it('accepts capitalization applied by the ATS template', () => {
    expect(comparePdfText('NORA EXAMPLE', { fields: [{ id: 'name', text: 'Nora Example' }] }))
      .toEqual({ state: 'text_checked', missingFieldIds: [] });
  });

  it('checks only fields actually present in the captured preview', () => {
    const preview = document.createElement('div');
    preview.innerHTML = 'ليلى Company 2024 Delivered results <span data-no-print>hidden@example.com</span>';
    const resume = { basics: { name: 'ليلى', email: 'hidden@example.com' }, work: [{ name: 'Company', startDate: '2024', endDate: '2025', highlights: ['• Delivered results', 'Excluded bullet'] }] };
    expect(expectedPdfText(resume as Parameters<typeof expectedPdfText>[0], preview)).toEqual({ fields: [
      { id: 'name', text: 'ليلى' }, { id: 'work.0.name', text: 'Company' }, { id: 'work.0.startDate', text: '2024' },
      { id: 'work.0.highlight', text: 'Delivered results' },
    ] });
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
