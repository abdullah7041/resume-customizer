// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import fontkit from '@pdf-lib/fontkit';
import type { TextPdfBlock, StyledPdfStyle } from '@/types/text-pdf.js';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// The root Vitest config aliases the package import to a UI mock. Load the real reader.
const { getDocument, OPS } = await import(new URL('../../../node_modules/pdfjs-dist/legacy/build/pdf.mjs', import.meta.url).href);
import { generateTextPdf, validateTextPdfBlocks } from '../text-pdf.js';

const original = ['نورة المثال', 'أعددت تقارير داخلية دون قياس للنتيجة.', 'نورة المثال SQL 25% 2024', 'لا لأ لإ لآ', '+966500000001'];
const extended = [...original, 'سَلَامُ عَلَيْكُمْ لَا لَأ لِإ لآ', 'نتيجة ٢٥٪ 25% ٢٠٢٤ 2024', '2020-01 – 2024-12 +966 50 123 4567', 'name@example.com https://example.com/profile?q=1', 'خبرة SQL تحليل Python تقارير Excel', 'Café résumé'];
const norm = (text: string) => text.replace(/\s/gu, '');
const blocks = (lines: string[]): TextPdfBlock[] => lines.map(text => ({ kind: 'body', runs: [{ text }] }));
const font = () => readFileSync(new URL('../../assets/fonts/DejaVuSans.ttf', import.meta.url));
const styledPresentation: StyledPdfStyle = { fontSize: 11, lineHeight: 16.5, direction: 'rtl', align: 'right', color: '#123456', bold: false, italic: false, spacingAfter: 6 };
async function savedPdf(lines: TextPdfBlock[], name: string, styles?: StyledPdfStyle[]) {
  const directory = mkdtempSync(join(tmpdir(), 'watheq-text-pdf-'));
  try {
    const path = join(directory, `${name}.pdf`);
    writeFileSync(path, generateTextPdf(lines, font(), styles));
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
  } finally {
    // mkdtemp owns this exact directory; retained audits use a separate evidence directory.
    rmSync(directory, { recursive: true, force: true });
  }
}
describe('logical text PDF saved bytes', () => {
  it('composes a styled mixed paragraph on one RTL line without changing source or links', async () => {
    const source = 'Engineer. لا تغيّر الحقائق. SQL 25% 2024 +966500000001 ٢٥٪ ٢٠٢٤';
    const input: TextPdfBlock[] = [{ kind: 'body', runs: [{ text: source, href: 'https://example.com/profile' }] }];
    const bytes = generateTextPdf(input, font(), [styledPresentation]);
    const document = await getDocument({ data: bytes, useSystemFonts: false }).promise;
    try {
      const page = await document.getPage(1);
      const items = (await page.getTextContent()).items.filter(item => 'str' in item && item.str.trim());
      expect(norm(items.map(item => 'str' in item ? item.str : '').join(' '))).toBe(norm(source));
      expect(new Set(items.map(item => 'transform' in item ? item.transform[5].toFixed(2) : ''))).toHaveLength(1);
      expect((await page.getAnnotations()).map(item => item.unsafeUrl)).toContain('https://example.com/profile');
      const english = items.find(item => 'str' in item && item.str.includes('Engineer'))!;
      const digits = items.find(item => 'str' in item && item.str.includes('٢٠٢٤'))!;
      expect('transform' in english && 'transform' in digits && english.transform[4] > digits.transform[4]).toBe(true);
    } finally { await document.destroy(); }
  });
  it('honors configured styled page margins in the generated geometry', async () => {
    const bytes = generateTextPdf(blocks(['Margin example']), font(), [{ ...styledPresentation, direction: 'ltr', align: 'left' }], { marginTop: 1, marginBottom: 1, marginSide: 1 });
    const document = await getDocument({ data: bytes, useSystemFonts: false }).promise;
    try {
      const item = (await (await document.getPage(1)).getTextContent()).items.find(item => 'str' in item && item.str.includes('Margin'))!;
      expect('transform' in item && item.transform[4]).toBeCloseTo(72, 2);
      expect('transform' in item && item.transform[5]).toBeCloseTo(841.89 - 72 - 11, 2);
    } finally { await document.destroy(); }
  });
  it('keeps parentheticals inline after Arabic without changing source', async () => {
    const source = 'بكالوريوس in علوم الحاسب | جامعة المثال (2020)';
    const document = await getDocument({ data: generateTextPdf(blocks([source]), font(), [styledPresentation]), useSystemFonts: false }).promise;
    try {
      const items = (await (await document.getPage(1)).getTextContent()).items.filter(item => 'str' in item && item.str.trim());
      expect(norm(items.map(item => 'str' in item ? item.str : '').join(' '))).toBe(norm(source));
      expect(new Set(items.map(item => 'transform' in item ? item.transform[5].toFixed(2) : ''))).toHaveLength(1);
    } finally { await document.destroy(); }
  });
  it('preserves Arabic parentheticals and mirrored symbols in the original source', async () => {
    const source = 'خبرة (عن بعد) [SQL] <2020> «عربي» القيمة ≤ ٢٥';
    expect(norm((await savedPdf(blocks([source]), 'mirrored-punctuation', [styledPresentation])).text)).toBe(norm(source));
  });
  it.each([['خبرة ([نص])', ')][('], ['خبرة (!نص!)', ')!!(']])('positions each adjacent RTL punctuation character correctly: %s', async (source, expected) => {
    const document = await getDocument({ data: generateTextPdf(blocks([source]), font(), [styledPresentation]), useSystemFonts: false }).promise;
    try {
      const ops = await (await document.getPage(1)).getOperatorList();
      const punctuation: { text: string; x: number }[] = [];
      let x = 0, size = 0;
      for (const [index, op] of ops.fnArray.entries()) {
        const args = ops.argsArray[index];
        if (op === OPS.setTextMatrix) x = args[0][4];
        if (op === OPS.setFont) size = args[1];
        if (op !== OPS.showText) continue;
        for (const glyph of args[0]) {
          if (typeof glyph === 'number') { x -= glyph * size / 1000; continue; }
          if (!glyph) continue;
          if (['(', ')', '[', ']', '!'].includes(glyph.unicode)) punctuation.push({ text: glyph.unicode, x });
          x += glyph.width * size / 1000;
        }
      }
      expect(punctuation.sort((a, b) => a.x - b.x).map(item => item.text).join('')).toBe(expected);
    } finally { await document.destroy(); }
  });
  it.each(['سلام', 'سَلام'])('retains Arabic shaping across style and link boundaries: %s', async source => {
    const geometry = async (split: boolean) => {
      const input: TextPdfBlock[] = [{ kind: 'body', runs: split ? [{ text: source.slice(0, 1) }, { text: source.slice(1), href: 'https://example.com' }] : [{ text: source }] }];
      const style = { ...styledPresentation, ...(split ? { emphasis: [{ start: 1, end: 2, bold: true, italic: false, color: '#123456' }] } : {}) };
      const document = await getDocument({ data: generateTextPdf(input, font(), [style]), useSystemFonts: false }).promise;
      try {
        const page = await document.getPage(1);
        const items = (await page.getTextContent()).items.filter(item => 'str' in item && item.str.trim());
        expect(norm(items.map(item => item.str).join(''))).toBe(norm(source));
        if (split) expect((await page.getAnnotations()).map(item => item.unsafeUrl)).toContain('https://example.com');
        return { left: Math.min(...items.map(item => item.transform[4])), right: Math.max(...items.map(item => item.transform[4] + item.width)) };
      } finally { await document.destroy(); }
    };
    const original = await geometry(false), styled = await geometry(true);
    expect(styled.left).toBeCloseTo(original.left, 4);
    expect(styled.right).toBeCloseTo(original.right, 4);
  });
  it.each(['office عربي', 'SQL عربي'])('preserves short mixed LTR source order: %s', async source => {
    expect(norm((await savedPdf(blocks([source]), 'mixed-ltr', [{ ...styledPresentation, direction: 'ltr', align: 'left' }])).text)).toBe(norm(source));
  });
  it.each([['office', 2], ['سَلام', 1]])('keeps links inside ligatures or marks clickable: %s', async (source, start) => {
    const input: TextPdfBlock[] = [{ kind: 'body', runs: [{ text: source.slice(0, start) }, { text: source.slice(start, start + 1), href: 'https://example.com/letter' }, { text: source.slice(start + 1) }] }];
    const document = await getDocument({ data: generateTextPdf(input, font(), [{ ...styledPresentation, emphasis: [{ start, end: start + 1, bold: true, italic: true, color: '#ff0000' }] }]), useSystemFonts: false }).promise;
    try {
      const links = (await (await document.getPage(1)).getAnnotations()).filter(item => item.unsafeUrl === 'https://example.com/letter');
      expect(links).toHaveLength(1);
      expect(links[0].rect[2]).toBeGreaterThan(links[0].rect[0]);
    } finally { await document.destroy(); }
  });
  it('renders balanced paired bracket outlines around Latin fields in an Arabic paragraph', async () => {
    const outlines = async (source: string, direction: 'ltr' | 'rtl') => {
      const document = await getDocument({ data: generateTextPdf(blocks([source]), font(), [{ ...styledPresentation, direction }]), useSystemFonts: false }).promise;
      try {
        const page = await document.getPage(1), ops = await page.getOperatorList();
        let fontId = '';
        const result: Record<string, string[]> = { square: [], angle: [] };
        for (const [index, op] of ops.fnArray.entries()) {
          if (op === OPS.setFont) fontId = ops.argsArray[index][0];
          if (op !== OPS.showText) continue;
          for (const glyph of ops.argsArray[index][0]) {
            if (!glyph || typeof glyph !== 'object' || !('unicode' in glyph) || !['[', ']', '<', '>'].includes(glyph.unicode)) continue;
            const font = page.commonObjs.get(fontId) as { charProcOperatorList: Record<string, { fnArray: number[]; argsArray: unknown[] }> };
            const outline = font.charProcOperatorList[glyph.operatorListId];
            result[glyph.unicode === '[' || glyph.unicode === ']' ? 'square' : 'angle'].push(JSON.stringify(outline));
          }
        }
        return Object.fromEntries(Object.entries(result).map(([kind, paths]) => [kind, paths.sort()]));
      } finally { await document.destroy(); }
    };
    expect(await outlines('خبرة [SQL] <2020>', 'rtl')).toEqual(await outlines('[] <>', 'ltr'));
  });
  it('preserves parentheticals split by inline emphasis and safe links', async () => {
    const input: TextPdfBlock[] = [{ kind: 'body', runs: [{ text: 'خبرة (' }, { text: '2020', href: 'https://example.com/year' }, { text: ')' }] }];
    const style = { ...styledPresentation, emphasis: [{ start: 6, end: 10, bold: true, italic: true, color: '#ff0000' }] };
    const result = await savedPdf(input, 'linked-year', [style]);
    expect(norm(result.text)).toBe(norm('خبرة (2020)'));
    expect(result.links).toContain('https://example.com/year');
  });
  it('renders captured chip gaps and inline emphasis without mutating the reviewed source', async () => {
    const input = blocks(['Engineering: TypeScriptSQL']);
    const before = JSON.stringify(input);
    const document = await getDocument({ data: generateTextPdf(input, font(), [{ ...styledPresentation, direction: 'ltr', align: 'left',
      spacedBoundaries: [23], emphasis: [{ start: 0, end: 12, bold: true, italic: true, color: '#ff0000' }] }]), useSystemFonts: false }).promise;
    try {
      const page = await document.getPage(1);
      const text = (await page.getTextContent()).items.map(item => 'str' in item ? item.str : '').join(' ');
      expect(text).toContain('TypeScript SQL');
      expect(JSON.stringify(input)).toBe(before);
      const ops = await page.getOperatorList();
      let fontId = '';
      const matrices: number[][] = [];
      for (const [index, op] of ops.fnArray.entries()) {
        if (op === OPS.setFont) fontId = ops.argsArray[index][0];
        if (op !== OPS.showText) continue;
        const font = page.commonObjs.get(fontId) as { charProcOperatorList: Record<string, { fnArray: number[]; argsArray: number[][] }> };
        for (const glyph of ops.argsArray[index][0]) {
          if (!glyph || typeof glyph !== 'object') continue;
          const procedure = font.charProcOperatorList[glyph.operatorListId];
          procedure.fnArray.forEach((operation, index) => { if (operation === OPS.transform) matrices.push(procedure.argsArray[index]); });
        }
      }
      expect(matrices.some(matrix => Math.abs(matrix[2] - 0.16) < 0.000001)).toBe(true);
      expect(matrices.some(matrix => matrix[2] === 0)).toBe(true);
    } finally { await document.destroy(); }
  });
  it.each(['السَّلَامُ عَلَيْكُمْ لَا لَأ لِإ لآ', '-٢٥ ٢٠-٢٥ ٢٠٢٢-٠١ -۲۵ ۲۰-۲۵'])('preserves styled mark clusters and inline numeric source: %s', async source => {
    expect(norm((await savedPdf(blocks([source]), 'styled-clusters', [styledPresentation])).text)).toBe(norm(source));
  });
  it('wraps styled paragraphs and rolls over font banks while keeping the complete source and links', async () => {
    const source = Array.from({ length: 275 }, (_, i) => `Project ${i}: لا تغيّر الحقائق. SQL 25% 2024 +966500000001 ٢٥٪ ٢٠٢٤ `);
    const input = blocks(source);
    input[0].runs[0].href = 'https://example.com/profile';
    const result = await savedPdf(input, 'styled-long', source.map(() => styledPresentation));
    expect(norm(result.text)).toBe(norm(source.join(' ')));
    expect(result.pages).toBeGreaterThan(1);
    expect(result.pages).toBeLessThanOrEqual(20);
    expect(result.links).toContain('https://example.com/profile');
    expect(Math.max(...result.fontChangesPerRow)).toBe(1);
  }, 30000);
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
  }, 90000); // PDF.js parses the large plain Type3 fixture slowly on Windows; source assertions stay exact.
  it('rejects missing glyphs, unsupported scripts, malformed scalars and invalid fonts', () => {
    for (const text of ['漢字', '😀', '\ud800', '\u200d', 'क']) expect(() => generateTextPdf(blocks([text]), font())).toThrow();
    expect(() => generateTextPdf(blocks(['Hello']), new Uint8Array([1, 2, 3]))).toThrow();
  });
  it('fails closed on combined mark ligatures instead of returning reordered source', () => {
    expect(() => generateTextPdf(blocks(['السَّلَامُ عَلَيْكُمْ لَا لَأ لِإ لآ']), font())).toThrow('Text PDF content cannot be rendered safely.');
  });
  it('preserves punctuation following Arabic-Indic numbers and percentages', async () => {
    const source = ['خفضت زمن استجابة الواجهة بنسبة ٢٠٪.', '"SQL 25% 2024" ٢٥٪ ٢٠٢٤.', '۲۰۲۴. ۲۵٪.',
      'بلغت القيمة ١٬٢٣٤٫٥٦٪. (٢٠٢٤) +٢٥.', 'مقدار ۱٬۲۳۴٫۵۶٪. (۲۰۲۴) +۲۵.',
      'مهندسة أولى | مختبرات الأرز', 'بكالوريوس in علوم الحاسب | جامعة المثال (2020)'];
    expect(norm((await savedPdf(blocks(source), 'arabic-numeric-punctuation')).text)).toBe(norm(source.join(' ')));
  });
  it.each(['-٢٥', '-۲۵', '- ٢٥', '-\n۲۵'])('rejects PDFium hyphenation loss for %s', source => {
    expect(() => generateTextPdf(blocks([source]), font())).toThrow('Text PDF content cannot be rendered safely.');
    expect(() => generateTextPdf(blocks(['-', source.replace(/^-\s*/u, '')]), font())).toThrow('Text PDF content cannot be rendered safely.');
    expect(() => generateTextPdf([{ kind: 'body', runs: [{ text: '-' }, { text: source.replace(/^-\s*/u, '') }] }], font())).toThrow('Text PDF content cannot be rendered safely.');
  });
  it('rejects ASCII-hyphen ranges and dates using Arabic numerals', () => {
    for (const source of ['٢٠-٢٥', '۲۰-۲۵', '٢٠٢٢-٠١']) expect(() => generateTextPdf(blocks([source]), font())).toThrow('Text PDF content cannot be rendered safely.');
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
