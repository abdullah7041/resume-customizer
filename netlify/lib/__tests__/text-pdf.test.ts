// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import fontkit from '@pdf-lib/fontkit';
import type { TextPdfBlock } from '@/types/text-pdf.js';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// The root Vitest config aliases the package import to a UI mock. Load the real reader.
const { getDocument, OPS } = await import(new URL('../../../node_modules/pdfjs-dist/legacy/build/pdf.mjs', import.meta.url).href);
import { generateTextPdf, validateTextPdfBlocks } from '../text-pdf.js';

const original = ['نورة المثال', 'أعددت تقارير داخلية دون قياس للنتيجة.', 'نورة المثال SQL 25% 2024', 'لا لأ لإ لآ', '+966500000001'];
const extended = [...original, 'سَلَامُ عَلَيْكُمْ لَا لَأ لِإ لآ', 'نتيجة ٢٥٪ 25% ٢٠٢٤ 2024', '2020-01 – 2024-12 +966 50 123 4567', 'name@example.com https://example.com/profile?q=1', 'خبرة SQL تحليل Python تقارير Excel', 'Café résumé'];
const norm = (text: string) => text.replace(/\s/gu, '');
const blocks = (lines: string[]) => lines.map(text => ({ kind: 'body' as const, runs: [{ text }] }));
const font = () => readFileSync(new URL('../../assets/fonts/DejaVuSans.ttf', import.meta.url));
async function savedPdf(lines: TextPdfBlock[], name: string) {
  const directory = mkdtempSync(join(tmpdir(), 'watheq-text-pdf-'));
  const path = join(directory, `${name}.pdf`);
  writeFileSync(path, generateTextPdf(lines, font()));
  const document = await getDocument({ data: new Uint8Array(readFileSync(path)), useSystemFonts: false }).promise;
  const text: string[] = [];
  const links: string[] = [];
  const fontChangesPerRow: number[] = [];
  for (let page = 1; page <= document.numPages; page++) {
    const pdfPage = await document.getPage(page);
    text.push((await pdfPage.getTextContent()).items.map(item => 'str' in item ? item.str : '').join(' '));
    links.push(...(await pdfPage.getAnnotations()).map(item => item.unsafeUrl).filter(Boolean));
    let fonts = 0;
    for (const op of (await pdfPage.getOperatorList()).fnArray) {
      if (op === OPS.beginText) fonts = 0;
      if (op === OPS.setFont) fonts++;
      if (op === OPS.endText) fontChangesPerRow.push(fonts);
    }
  }
  const pages = document.numPages;
  await document.destroy();
  return { text: text.join(' '), pageTexts: text, links, pages, fontChangesPerRow };
}
describe('logical text PDF saved bytes', () => {
  it.each([['original', original], ['extended', extended]] as const)('preserves complete %s source in order', async (name, lines) => {
    const input = blocks([...lines]);
    const before = JSON.stringify(input);
    expect(norm((await savedPdf(input, name)).text)).toBe(norm(lines.join(' ')));
    expect(JSON.stringify(input)).toBe(before);
  });
  it('wraps, paginates and rolls font banks over without losing numbered bullets or links', async () => {
    const input = blocks(Array.from({ length: 310 }, (_, i) => `${i + 1}. Job ${i + 1}: delivered customer reports with accurate financial analysis and documented outcomes.`));
    input[0].runs[0] = { text: 'https://example.com/profile', href: 'https://example.com/profile' } as typeof input[0]['runs'][0];
    const result = await savedPdf(input, 'multipage');
    expect(result.pages).toBeGreaterThan(1);
    expect(result.pages).toBeLessThanOrEqual(20);
    expect(norm(result.text)).toBe(norm(input.flatMap(block => block.runs.map(run => run.text)).join(' ')));
    expect(result.links).toContain('https://example.com/profile');
  }, 30000);
  it('rejects missing glyphs, unsupported scripts, malformed scalars and invalid fonts', () => {
    for (const text of ['漢字', '😀', '\ud800', '\u200d', 'क']) expect(() => generateTextPdf(blocks([text]), font())).toThrow();
    expect(() => generateTextPdf(blocks(['Hello']), new Uint8Array([1, 2, 3]))).toThrow();
  });
  it('fails closed on combined mark ligatures instead of returning reordered source', () => {
    expect(() => generateTextPdf(blocks(['السَّلَامُ عَلَيْكُمْ لَا لَأ لِإ لآ']), font())).toThrow('Text PDF content cannot be rendered safely.');
  });
  it('rejects compatibility ligatures that PDF.js rewrites to different scalars', () => {
    expect(() => generateTextPdf(blocks(['ﬁ']), font())).toThrow('Text PDF content cannot be rendered safely.');
  });
  it('keeps the final row of a wrapped heading with the following job', async () => {
    const input = [...blocks(Array.from({ length: 30 }, (_, i) => `Entry ${i}`)), { kind: 'heading' as const, runs: [{ text: 'Long section heading '.repeat(11) + 'HeadingEnd' }] }, ...blocks(['Following job'])];
    const result = await savedPdf(input, 'heading');
    expect(result.pageTexts.find(text => text.includes('HeadingEnd'))).toContain('Following job');
  });
  it('encodes operator-like source literally and wraps long unbroken source', async () => {
    const source = ['BT /F1 12 Tf (private) Tj ET < > \\ /ActualText', 'https://example.com/' + 'profile'.repeat(80)];
    expect(norm((await savedPdf(blocks(source), 'literal')).text)).toBe(norm(source.join(' ')));
  });
  it('keeps each Arabic row in one font bank so pypdf cannot reorder fragments at rollover', async () => {
    const source = [...Array.from({ length: 254 }, (_, i) => `Job ${i}`), 'نورة المثال أعددت تقارير داخلية دون قياس للنتيجة.'];
    const result = await savedPdf(blocks(source), 'arabic-rollover');
    expect(norm(result.text)).toBe(norm(source.join(' ')));
    expect(Math.max(...result.fontChangesPerRow)).toBe(1);
  });
  it('rejects a shaping result whose glyph scalars no longer match the source', () => {
    const parsed = fontkit.create(font());
    const layout = parsed.layout.bind(parsed);
    vi.spyOn(parsed, 'layout').mockImplementation((text, features) => {
      const result = layout(text, features);
      result.glyphs[0].codePoints = [0x5a];
      return result;
    });
    const create = vi.spyOn(fontkit, 'create').mockReturnValue(parsed);
    try { expect(() => generateTextPdf(blocks(['ABC']), font())).toThrow('Text PDF content cannot be rendered safely.'); }
    finally { create.mockRestore(); }
  });
  it('rejects a document that exceeds twenty pages', () => {
    expect(() => generateTextPdf(blocks(Array.from({ length: 1000 }, () => 'Long line '.repeat(9))), font())).toThrow();
  });
});
describe('text PDF request validation', () => {
  it('rejects coerced block kinds instead of returning malformed typed data', () => {
    expect(() => validateTextPdfBlocks([{ kind: ['body'], runs: [{ text: 'private resume' }] }])).toThrow('Text PDF content cannot be rendered safely.');
  });
  it.each([null, [], {}, [{kind:'invalid',runs:[{text:'X'}]}], [{kind:'body',runs:[]}], [{kind:'body',runs:[{text:''}]}], [{kind:'body',runs:[{text:4}]}], blocks(['x'.repeat(10001)]), Array.from({length:1001},()=>blocks(['x'])[0]), blocks(Array.from({length:11},()=> 'x'.repeat(10000))), [{kind:'body',runs:Array.from({length:1001},()=>({text:'x'}))}]])('rejects malformed or excessive payload without echoing it', value => {
    expect(() => validateTextPdfBlocks(value)).toThrow();
  });
  it.each(['javascript:alert(1)', 'data:text/html,test', 'file:///secret', '/relative', 'https://user:password@example.com', 'https://example.com\n'])('rejects unsafe link %s', href => {
    expect(() => validateTextPdfBlocks([{kind:'body',runs:[{text:'private resume',href}]}])).toThrow();
  });
  it('preserves valid immutable data and safe links', () => {
    const value = [{kind:'title',runs:[{text:'Name',href:'mailto:name@example.com'}]}, {kind:'bullet',runs:[{text:'+966500000001',href:'tel:+966500000001'}]}];
    expect(validateTextPdfBlocks(value)).toEqual(value);
  });
});
