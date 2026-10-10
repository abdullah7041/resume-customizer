/// <reference lib="es2022.intl" />
import fontkit, { type Font, type Glyph, type GlyphRun } from '@pdf-lib/fontkit';
import { jsPDF } from 'jspdf';
import type { TextPdfBlock, TextPdfBox, TextPdfPiece, TextPdfPlacedPiece, TextPdfFontHook, TextPdfBidi, TextPdfPathCommands } from '@/types/text-pdf.js';

const PAGE_WIDTH = 595.28, PAGE_HEIGHT = 841.89, MARGIN = 43.2, VERTICAL = 54;
function fail(): never { throw Object.assign(new Error('Text PDF content cannot be rendered safely.'), { status: 422, code: 'pdf/text-unsupported' }); }
const number = (value: number) => { if (!Number.isFinite(value)) fail(); return Number(value.toFixed(6)).toString(); };
const hex = (text: string) => Array.from({ length: text.length }, (_, i) => text.charCodeAt(i).toString(16).padStart(4, '0')).join('');
const mark = (text: string) => /^\p{M}+$/u.test(text);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function validateTextPdfBlocks(value: unknown): TextPdfBlock[] {
  if (!Array.isArray(value) || !value.length || value.length > 1000) fail();
  let length = 0;
  return value.map(block => {
    if (!record(block) || typeof block.kind !== 'string' || !['title', 'heading', 'body', 'bullet'].includes(block.kind) || !Array.isArray(block.runs) || !block.runs.length || block.runs.length > 1000) fail();
    const runs = block.runs.map(run => {
      if (!record(run) || typeof run.text !== 'string' || !run.text.trim() || run.text.length > 10000) fail();
      length += run.text.length;
      if (length > 100000 || /[\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/u.test(run.text)) fail();
      for (const scalar of run.text) {
        const cp = scalar.codePointAt(0)!;
        if ((cp < 32 && ![9, 10, 13].includes(cp)) || (cp >= 0xd800 && cp <= 0xdfff)) fail();
      }
      if (run.href !== undefined) {
        if (typeof run.href !== 'string' || run.href.length > 2048 || /\s/u.test(run.href)) fail();
        try {
          const url = new URL(run.href);
          if (!['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol) || url.username || url.password) fail();
        } catch { fail(); }
      }
      return { text: run.text, ...(run.href === undefined ? {} : { href: run.href as string }) };
    });
    return { kind: block.kind as TextPdfBlock['kind'], runs };
  });
}

function outline(glyph: Glyph): string {
  let x = 0, y = 0, sx = 0, sy = 0;
  const result: string[] = [];
  for (const { command, args } of (glyph.path as unknown as TextPdfPathCommands).commands) {
    if (command === 'moveTo') { [x, y] = args; [sx, sy] = args; result.push(`${args.map(number).join(' ')} m`); }
    else if (command === 'lineTo') { [x, y] = args; result.push(`${args.map(number).join(' ')} l`); }
    else if (command === 'quadraticCurveTo') {
      const [qx, qy, nx, ny] = args;
      result.push(`${[x + 2 * (qx - x) / 3, y + 2 * (qy - y) / 3, nx + 2 * (qx - nx) / 3, ny + 2 * (qy - ny) / 3, nx, ny].map(number).join(' ')} c`);
      [x, y] = [nx, ny];
    } else if (command === 'bezierCurveTo') { result.push(`${args.map(number).join(' ')} c`); [x, y] = args.slice(4); }
    else if (command === 'closePath') { result.push('h'); [x, y] = [sx, sy]; }
    else fail();
  }
  return result.join('\n') + '\nf';
}

const union = (boxes: TextPdfBox[]): TextPdfBox => [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])), Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))];
function serializeFont(args: TextPdfFontHook, pieces: TextPdfPiece[]) {
  const refs = pieces.map(piece => { const id = args.newObject(); args.putStream({ data: piece.content }); args.out('endobj'); return id; });
  const mappings = pieces.map((piece, i) => `<${(i + 1).toString(16).padStart(2, '0')}> <${hex(piece.text)}>`);
  const groups = [];
  for (let i = 0; i < mappings.length; i += 100) { const group = mappings.slice(i, i + 100); groups.push(`${group.length} beginbfchar\n${group.join('\n')}\nendbfchar`); }
  const cmap = args.newObject();
  args.putStream({ data: `/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /LogicalText def /CMapType 2 def 1 begincodespacerange <01> <ff> endcodespacerange ${groups.join('\n')} endcmap CMapName currentdict /CMap defineresource pop end end` });
  args.out('endobj');
  args.font.objectNumber = args.newObject();
  args.out(`<< /Type /Font /Subtype /Type3 /FontBBox [${union(pieces.map(p => p.box)).map(number).join(' ')}] /FontMatrix [0.001 0 0 0.001 0 0]`);
  args.out(`/CharProcs << ${refs.map((ref, i) => `/g${i + 1} ${ref} 0 R`).join(' ')} >>`);
  args.out(`/Encoding << /Type /Encoding /Differences [1 ${pieces.map((_, i) => `/g${i + 1}`).join(' ')}] >>`);
  args.out(`/FirstChar 1 /LastChar ${pieces.length} /Widths [${pieces.map(p => number(p.width)).join(' ')}] /Resources << >> /ToUnicode ${cmap} 0 R >>`);
  args.out('endobj'); args.font.isAlreadyPutted = true;
}

export function generateTextPdf(input: TextPdfBlock[], fontBytes: Uint8Array): Uint8Array {
  const blocks = validateTextPdfBlocks(input);
  let font: Font;
  try { font = fontkit.create(fontBytes); } catch { return fail(); }
  if (!font.unitsPerEm || !font.layout || !font.hasGlyphForCodePoint) fail();
  const scale = 1000 / font.unitsPerEm;
  const shapes = new Map<string, GlyphRun>();
  const shape = (text: string, rtl: boolean) => {
    const key = `${rtl}:${text}`;
    let result = shapes.get(key);
    if (!result) { result = (font.layout as (text: string, features: string[], script: string, language: string, direction: string) => GlyphRun)(text, [], rtl ? 'arab' : 'latn', rtl ? 'ar' : 'en', rtl ? 'rtl' : 'ltr'); shapes.set(key, result); }
    return result;
  };
  const pdf = new jsPDF({ unit: 'pt', format: [PAGE_WIDTH, PAGE_HEIGHT], compress: true });
  const writer = pdf.internal as typeof pdf.internal & { write(text: string): void; getFont(name: string, style: string): { id: string } };
  const availableFonts = Object.entries(pdf.getFontList()).flatMap(([name, styles]) => styles.map(style => writer.getFont(name, style).id));
  const banks: { id: string; pieces: TextPdfPiece[]; codes: Map<string, string> }[] = [];
  const shapedRows = new Map<string, { placed: TextPdfPlacedPiece[]; width: number }>();
  pdf.internal.events.subscribe('putFont', (args: TextPdfFontHook) => { const bank = banks.find(b => b.id === args.font.id); if (bank) serializeFont(args, bank.pieces); });
  function encodeRow(pieces: TextPdfPlacedPiece[]) {
    const keys = pieces.map(item => JSON.stringify(item.piece));
    let bank = banks[banks.length - 1];
    const missing = new Set(keys.filter(key => !bank?.codes.has(key))).size;
    if (!bank || bank.pieces.length + missing > 255) {
      if (new Set(keys).size > 255) fail();
      let id = availableFonts[banks.length];
      if (!id) {
        const name = `Logical${banks.length}`;
        pdf.addFileToVFS(name, Buffer.from(fontBytes).toString('base64'));
        id = pdf.addFont(name, name, 'normal', undefined, 'WinAnsiEncoding');
      }
      bank = { id, pieces: [], codes: new Map() }; banks.push(bank);
    }
    // Switching Type3 fonts inside an RTL row makes pypdf reorder text fragments.
    // Cache within banks and reserve the whole row before emitting its text object.
    return pieces.map((item, index) => {
      const key = keys[index];
      let code = bank.codes.get(key);
      if (!code) { bank.pieces.push(item.piece); code = bank.pieces.length.toString(16).padStart(2, '0'); bank.codes.set(key, code); }
      return { id: bank.id, code };
    });
  }
  function piecesFor(text: string, rtl: boolean): { placed: TextPdfPlacedPiece[]; width: number } {
    // fontkit caches glyphs by ID, including empty provenance from earlier shaping.
    // A fresh Arabic layout keeps this row's source assertions independent of prior rows.
    const rowFont = rtl ? fontkit.create(fontBytes) : font;
    const run = rtl ? (rowFont.layout as (text: string, features: string[], script: string, language: string, direction: string) => GlyphRun)(text, [], 'arab', 'ar', 'rtl') : shape(text, false);
    const placedGlyphs = run.glyphs.map((glyph, i) => ({ glyph, pos: run.positions[i], x: 0 }));
    let pen = 0;
    for (const item of placedGlyphs) { if (!item.glyph.id) fail(); item.x = pen; pen += item.pos.xAdvance; }
    const draw = (items: typeof placedGlyphs, origin: number) => {
      const boxes: TextPdfBox[] = [];
      const paths = items.map(({ glyph, pos, x }) => {
        const b = (glyph.path as unknown as TextPdfPathCommands).commands.length ? glyph.bbox : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        boxes.push([(b.minX + x + pos.xOffset - origin) * scale, (b.minY + pos.yOffset) * scale, (b.maxX + x + pos.xOffset - origin) * scale, (b.maxY + pos.yOffset) * scale]);
        return `q ${number(scale)} 0 0 ${number(scale)} ${number((x + pos.xOffset - origin) * scale)} ${number(pos.yOffset * scale)} cm ${outline(glyph)} Q`;
      });
      return { box: union(boxes), content: paths.join('\n') };
    };
    if (!rtl) {
      if (run.glyphs.map(g => String.fromCodePoint(...g.codePoints)).join('') !== text) fail();
      const width = pen * scale, drawing = draw(placedGlyphs, 0);
      return { width, placed: [{ x: 0, piece: { text, width, box: drawing.box, content: `${number(width)} 0 ${drawing.box.map(number).join(' ')} d1\n${drawing.content}` } }] };
    }
    // Group zero-advance marks with their shaped base; match source clusters before encoding.
    const logical = [...placedGlyphs].reverse();
    const placed: TextPdfPlacedPiece[] = [];
    let sourceIndex = 0;
    for (let i = 0; i < logical.length;) {
      const base = logical[i++];
      const basePoints = base.glyph.codePoints;
      if (!basePoints.length || basePoints.some(cp => mark(String.fromCodePoint(cp)))) fail();
      const group = [base];
      while (i < logical.length && logical[i].glyph.codePoints.every(cp => mark(String.fromCodePoint(cp)))) group.push(logical[i++]);
      const sourcePieces: string[] = [];
      const sourceMarks: number[] = [];
      for (const cp of basePoints) {
        const scalar = String.fromCodePoint(cp);
        if (!text.startsWith(scalar, sourceIndex)) fail();
        sourceIndex += scalar.length;
        let source = scalar;
        while (sourceIndex < text.length) { const next = String.fromCodePoint(text.codePointAt(sourceIndex)!); if (!mark(next)) break; source += next; sourceMarks.push(next.codePointAt(0)!); sourceIndex += next.length; }
        sourcePieces.push(source);
      }
      const glyphMarks = group.slice(1).flatMap(item => item.glyph.codePoints);
      if (sourceMarks.slice().sort().join() !== glyphMarks.slice().sort().join()) fail();
      if (basePoints.length > 1 && !(basePoints.length === 2 && basePoints[0] === 0x644 && [0x627, 0x622, 0x623, 0x625].includes(basePoints[1]))) fail();
      if (group.slice(1).some(item => item.glyph.codePoints.length !== 1)) fail();
      const unusedMarks = group.slice(1);
      const drawing = draw([base], base.x);
      const width = base.pos.xAdvance * scale / sourcePieces.length;
      for (let j = 0; j < sourcePieces.length; j++) {
        const offset = j * width, min = j === 0 ? Math.min(0, drawing.box[0]) : offset;
        const max = j === sourcePieces.length - 1 ? Math.max(offset + width, drawing.box[2]) : offset + width;
        const box: TextPdfBox = [Math.max(min, drawing.box[0]) - offset, drawing.box[1], Math.min(max, drawing.box[2]) - offset, drawing.box[3]];
        const clip = sourcePieces.length > 1 ? `${number(min)} ${number(drawing.box[1])} ${number(max - min)} ${number(drawing.box[3] - drawing.box[1])} re W n` : '';
        const sourceScalars = [...sourcePieces[sourcePieces.length - 1 - j]];
        for (const scalar of sourceScalars.slice(1).reverse()) {
          const index = unusedMarks.findIndex(item => item.glyph.codePoints[0] === scalar.codePointAt(0));
          if (index < 0) fail();
          const markGlyph = unusedMarks.splice(index, 1)[0];
          const markDrawing = draw([markGlyph], base.x + offset / scale);
          placed.push({ x: base.x * scale + offset, piece: { text: scalar, width: 0, box: markDrawing.box, content: `0 0 ${markDrawing.box.map(number).join(' ')} d1\n${markDrawing.content}` } });
        }
        const piece = { text: sourceScalars[0], width, box, content: `${number(width)} 0 ${box.map(number).join(' ')} d1\nq 1 0 0 1 ${number(-offset)} 0 cm ${clip}\n${drawing.content}\nQ` };
        placed.push({ piece, x: base.x * scale + offset });
      }
    }
    if (sourceIndex !== text.length) fail();
    return { placed: placed.sort((a, b) => a.x - b.x), width: pen * scale };
  }
  const Bidi = (jsPDF as unknown as { __bidiEngine__: new (options: Record<string, boolean>) => TextPdfBidi }).__bidiEngine__;
  const bidi = new Bidi({ isInputVisual: false, isInputRtl: false, isOutputVisual: true, isOutputRtl: false, isSymmetricSwapping: false });
  function directionRuns(text: string) {
    for (const scalar of text) {
      if (scalar.length !== 1 || /[\ufb00-\ufb06]/u.test(scalar) || !/^[\p{Script=Latin}\p{Script=Arabic}\p{Script=Common}\p{Script=Inherited}]$/u.test(scalar) || !font.hasGlyphForCodePoint(scalar.codePointAt(0)!)) fail();
    }
    const levels: number[] = [];
    bidi.doBidiReorder(text, [], levels); // Only resolved levels are used; never the reordered string.
    if (levels.length !== text.length) fail();
    const runs: { text: string; rtl: boolean }[] = [];
    for (let i = 0; i < text.length; i++) {
      const rtl = levels[i] % 2 === 1;
      if (!runs.length || runs[runs.length - 1].rtl !== rtl) runs.push({ text: text[i], rtl });
      else runs[runs.length - 1].text += text[i];
    }
    return runs;
  }
  const graphemes = new Intl.Segmenter('ar', { granularity: 'grapheme' });
  function wrap(text: string, rtl: boolean, size: number) {
    const rows: string[] = [];
    let row = '';
    const fits = (candidate: string) => candidate.length <= 255 && shape(candidate, rtl).positions.reduce((sum, pos) => sum + pos.xAdvance, 0) * scale * size / 1000 <= PAGE_WIDTH - MARGIN * 2;
    for (const token of text.match(/\s+|\S+/gu) ?? []) {
      if (fits(row + token)) { row += token; continue; }
      if (row) { rows.push(row); row = ''; }
      if (fits(token)) { row = token; continue; }
      for (const { segment } of graphemes.segment(token)) {
        if (!fits(row + segment)) { if (!row) fail(); rows.push(row); row = ''; }
        row += segment;
      }
    }
    if (row) rows.push(row);
    return rows;
  }
  let y = VERTICAL, pages = 1;
  function ensureSpace(height: number) { if (y + height > PAGE_HEIGHT - VERTICAL) { if (++pages > 20) fail(); pdf.addPage(); y = VERTICAL; } }
  for (const block of blocks) {
    const size = block.kind === 'title' ? 16 : 11, lineHeight = size * 1.5;
    const rows = block.runs.flatMap(sourceRun => sourceRun.text.split(/\r\n|[\n\r\t]/u).filter(Boolean).flatMap(paragraph =>
      directionRuns(paragraph).flatMap(run => wrap(run.text, run.rtl, size).map(text => ({ text: text.trim(), rtl: run.rtl, href: sourceRun.href }))).filter(row => row.text)));
    const heading = block.kind === 'heading' || block.kind === 'title';
    if (heading) ensureSpace(Math.min(rows.length * lineHeight + 6 + 24, PAGE_HEIGHT - VERTICAL * 2));
    for (const [rowIndex, run] of rows.entries()) {
        const row = run.text;
        const rowKey = `${run.rtl}:${row}`;
        let shaped = shapedRows.get(rowKey);
        if (!shaped) { shaped = piecesFor(row, run.rtl); shapedRows.set(rowKey, shaped); }
        ensureSpace(heading && rowIndex === rows.length - 1 ? lineHeight + 6 + 24 : lineHeight);
        const baseline = y + size;
        writer.write(`/Span << /ActualText <feff${hex(row)}> >> BDC`);
        writer.write('BT');
        let activeFont = '', cursor = 0, encoded = '', tj: string[] = [];
        const flush = () => { if (encoded) { tj.push(`<${encoded}>`); encoded = ''; } if (tj.length) writer.write(`[${tj.join(' ')}] TJ`); tj = []; };
        const codes = encodeRow(shaped.placed);
        for (const [index, { piece, x }] of shaped.placed.entries()) {
          const code = codes[index];
          if (activeFont !== code.id) { flush(); writer.write(`/${code.id} ${number(size)} Tf 1 0 0 1 ${number(MARGIN + x * size / 1000)} ${number(PAGE_HEIGHT - baseline)} Tm`); activeFont = code.id; cursor = x; }
          const adjustment = cursor - x;
          if (adjustment) { if (encoded) { tj.push(`<${encoded}>`); encoded = ''; } tj.push(number(adjustment)); }
          encoded += code.code; cursor = x + piece.width;
        }
        flush(); writer.write('ET'); writer.write('EMC');
        if (run.href) pdf.link(MARGIN, y, shaped.width * size / 1000, lineHeight, { url: run.href });
        y += lineHeight;
    }
    y += 6;
  }
  return new Uint8Array(pdf.output('arraybuffer'));
}
