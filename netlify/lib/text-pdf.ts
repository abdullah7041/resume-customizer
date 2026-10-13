/// <reference lib="es2022.intl" />
import fontkit, { type Font, type Glyph, type GlyphRun, type TypeFeatures } from '@pdf-lib/fontkit';
import { jsPDF } from 'jspdf';
import bidiFactory from 'bidi-js';
import type { TextPdfBlock, TextPdfBox, TextPdfPiece, TextPdfPlacedPiece, TextPdfFontHook, TextPdfBidi, TextPdfPathCommands, StyledPdfStyle, StyledPdfMargins } from '@/types/text-pdf.js';

const PAGE_WIDTH = 595.28, PAGE_HEIGHT = 841.89;
// bidi-js publishes CommonJS with ESM declarations; NodeNext types its factory as a namespace.
const styledBidi = (bidiFactory as unknown as () => import('bidi-js').Bidi)();
function fail(): never { throw Object.assign(new Error('Text PDF content cannot be rendered safely.'), { status: 422, code: 'pdf/text-unsupported' }); }
const number = (value: number) => { if (!Number.isFinite(value)) fail(); return Number(value.toFixed(6)).toString(); };
const hex = (text: string) => Array.from({ length: text.length }, (_, i) => text.charCodeAt(i).toString(16).padStart(4, '0')).join('');
const mark = (text: string) => /^\p{M}+$/u.test(text);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const hasArabicLetters = (text: string) => /\p{Script=Arabic}/u.test(text.replace(/[\u0660-\u0669\u06f0-\u06f9]/gu, ''));

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
function serializeFont(args: TextPdfFontHook, pieces: TextPdfPiece[], named = false) {
  const refs = pieces.map(piece => { const id = args.newObject(); args.putStream({ data: piece.content }); args.out('endobj'); return id; });
  const mappings = pieces.map((piece, i) => `<${(i + 1).toString(16).padStart(2, '0')}> <${hex(piece.text)}>`);
  const groups = [];
  for (let i = 0; i < mappings.length; i += 100) { const group = mappings.slice(i, i + 100); groups.push(`${group.length} beginbfchar\n${group.join('\n')}\nendbfchar`); }
  const cmap = args.newObject();
  args.putStream({ data: `/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /LogicalText def /CMapType 2 def 1 begincodespacerange <01> <ff> endcodespacerange ${groups.join('\n')} endcmap CMapName currentdict /CMap defineresource pop end end` });
  args.out('endobj');
  const box = union(pieces.map(p => p.box));
  let descriptor: number | undefined;
  if (named) {
    descriptor = args.newObject();
    args.out(`<< /Type /FontDescriptor /FontName /DejaVuSans-${args.font.id} /Flags 4 /FontBBox [${box.map(number).join(' ')}] /ItalicAngle 0 /Ascent ${number(box[3])} /Descent ${number(Math.min(0, box[1]))} /CapHeight ${number(box[3])} /StemV 80 >>`);
    args.out('endobj');
  }
  args.font.objectNumber = args.newObject();
  args.out(`<< /Type /Font /Subtype /Type3 /FontBBox [${box.map(number).join(' ')}] /FontMatrix [0.001 0 0 0.001 0 0]${descriptor ? ` /FontDescriptor ${descriptor} 0 R` : ''}`);
  args.out(`/CharProcs << ${refs.map((ref, i) => `/g${i + 1} ${ref} 0 R`).join(' ')} >>`);
  args.out(`/Encoding << /Type /Encoding /Differences [1 ${pieces.map((_, i) => `/g${i + 1}`).join(' ')}] >>`);
  args.out(`/FirstChar 1 /LastChar ${pieces.length} /Widths [${pieces.map(p => number(p.width)).join(' ')}] /Resources << >> /ToUnicode ${cmap} 0 R >>`);
  args.out('endobj'); args.font.isAlreadyPutted = true;
}

export function validateStyledPdfStyles(value: unknown, blocks: TextPdfBlock[]): StyledPdfStyle[] {
  if (!Array.isArray(value) || value.length !== blocks.length) fail();
  return value.map((style, index) => {
    if (!record(style) || Object.keys(style).some(key => !['fontSize', 'lineHeight', 'color', 'bold', 'italic', 'align', 'direction', 'spacingAfter', 'borderColor', 'spacedBoundaries', 'emphasis'].includes(key))) fail();
    for (const [key, min, max] of [['fontSize', 6, 32], ['lineHeight', 8, 72], ['spacingAfter', 0, 36]] as const) {
      if (typeof style[key] !== 'number' || !Number.isFinite(style[key]) || style[key] < min || style[key] > max) fail();
    }
    if (typeof style.color !== 'string' || !/^#[0-9a-f]{6}$/iu.test(style.color) ||
        typeof style.bold !== 'boolean' || typeof style.italic !== 'boolean' ||
        !['left', 'center', 'right'].includes(style.align as string) || !['ltr', 'rtl'].includes(style.direction as string) ||
        (style.borderColor !== undefined && (typeof style.borderColor !== 'string' || !/^#[0-9a-f]{6}$/iu.test(style.borderColor)))) fail();
    if ((style.lineHeight as number) < (style.fontSize as number)) fail();
    const length = blocks[index].runs.reduce((sum, run) => sum + run.text.length, 0);
    if (style.spacedBoundaries !== undefined && (!Array.isArray(style.spacedBoundaries) || style.spacedBoundaries.length > 1000 ||
      style.spacedBoundaries.some(position => !Number.isInteger(position) || position <= 0 || position >= length))) fail();
    if (style.emphasis !== undefined && (!Array.isArray(style.emphasis) || style.emphasis.length > 1000 || style.emphasis.some(range =>
      !record(range) || Object.keys(range).some(key => !['start', 'end', 'bold', 'italic', 'color'].includes(key)) ||
      !Number.isInteger(range.start) || !Number.isInteger(range.end) || (range.start as number) < 0 || (range.end as number) > length || (range.end as number) <= (range.start as number) ||
      typeof range.bold !== 'boolean' || typeof range.italic !== 'boolean' || typeof range.color !== 'string' || !/^#[0-9a-f]{6}$/iu.test(range.color)))) fail();
    return { ...style } as unknown as StyledPdfStyle;
  });
}

export function validateStyledPdfMargins(value: unknown): StyledPdfMargins {
  if (value === undefined) return {};
  if (!record(value) || Object.keys(value).some(key => !['marginTop', 'marginBottom', 'marginSide'].includes(key))) fail();
  for (const number of Object.values(value)) if (typeof number !== 'number' || !Number.isFinite(number) || number < 0.3 || number > 1) fail();
  return { ...value } as StyledPdfMargins;
}

export function generateTextPdf(input: TextPdfBlock[], fontBytes: Uint8Array, presentation?: StyledPdfStyle[], geometry?: StyledPdfMargins): Uint8Array {
  const blocks = validateTextPdfBlocks(input);
  const styles = presentation === undefined ? undefined : validateStyledPdfStyles(presentation, blocks);
  const margins = validateStyledPdfMargins(geometry);
  const MARGIN = styles ? (margins.marginSide ?? 0.6) * 72 : 43.2;
  const VERTICAL = styles ? (margins.marginTop ?? 0.5) * 72 : 54;
  const BOTTOM = styles ? (margins.marginBottom ?? 0.5) * 72 : 54;
  // PDFium treats this row boundary as discretionary hyphenation and loses '-'.
  if (!styles && /-\s*[\u0660-\u0669\u06f0-\u06f9]/u.test(blocks.flatMap(block => block.runs.map(run => run.text)).join('\n'))) fail();
  let font: Font;
  try { font = fontkit.create(fontBytes); } catch { return fail(); }
  if (!font.unitsPerEm || !font.layout || !font.hasGlyphForCodePoint) fail();
  const scale = 1000 / font.unitsPerEm;
  const shapes = new Map<string, GlyphRun>();
  const shape = (text: string, rtl: boolean) => {
    const key = `${rtl}:${text}`;
    let result = shapes.get(key);
    if (!result) { result = (font.layout as (text: string, features: string[] | TypeFeatures, script: string, language: string, direction: string) => GlyphRun)(text, styles && !rtl ? { liga: false, clig: false } : [], rtl ? 'arab' : 'latn', rtl ? 'ar' : 'en', rtl ? 'rtl' : 'ltr'); shapes.set(key, result); }
    return result;
  };
  const pdf = new jsPDF({ unit: 'pt', format: [PAGE_WIDTH, PAGE_HEIGHT], compress: true });
  const writer = pdf.internal as typeof pdf.internal & { write(text: string): void; getFont(name: string, style: string): { id: string } };
  const availableFonts = Object.entries(pdf.getFontList()).flatMap(([name, styles]) => styles.map(style => writer.getFont(name, style).id));
  const banks: { id: string; pieces: TextPdfPiece[]; codes: Map<string, string>; rtl?: boolean }[] = [];
  const shapedRows = new Map<string, { placed: TextPdfPlacedPiece[]; width: number }>();
  pdf.internal.events.subscribe('putFont', (args: TextPdfFontHook) => { const bank = banks.find(b => b.id === args.font.id); if (bank) serializeFont(args, bank.pieces, !!styles); });
  function encodeRow(pieces: TextPdfPlacedPiece[], rtl?: boolean) {
    const keys = pieces.map(item => JSON.stringify(item.piece));
    let bank = [...banks].reverse().find(bank => bank.rtl === rtl);
    const missing = new Set(keys.filter(key => !bank?.codes.has(key))).size;
    if (!bank || bank.pieces.length + missing > 255) {
      if (new Set(keys).size > 255) fail();
      let id = availableFonts[banks.length];
      if (!id) {
        const name = `Logical${banks.length}`;
        pdf.addFileToVFS(name, Buffer.from(fontBytes).toString('base64'));
        id = pdf.addFont(name, name, 'normal', undefined, 'WinAnsiEncoding');
      }
      bank = { id, pieces: [], codes: new Map(), rtl }; banks.push(bank);
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
      if (styles) {
        // PDFium uses character advance to decide which objects share a row.
        // A whole Latin run encoded as one wide character merges unrelated styled rows.
        return { width: pen * scale, placed: placedGlyphs.map(item => {
          const width = item.pos.xAdvance * scale, drawing = draw([item], item.x);
          return { x: item.x * scale, piece: { text: String.fromCodePoint(...item.glyph.codePoints), width, box: drawing.box,
            content: `${number(width)} 0 ${drawing.box.map(number).join(' ')} d1\n${drawing.content}` } };
        }) };
      }
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
      if (!styles && group.slice(1).some(item => item.glyph.codePoints.length !== 1)) fail();
      const unusedMarks = group.slice(1).map(item => ({ item, points: [...item.glyph.codePoints], drawn: false }));
      const drawing = draw([base], base.x);
      const width = base.pos.xAdvance * scale / sourcePieces.length;
      for (let j = 0; j < sourcePieces.length; j++) {
        const offset = j * width, min = j === 0 ? Math.min(0, drawing.box[0]) : offset;
        const max = j === sourcePieces.length - 1 ? Math.max(offset + width, drawing.box[2]) : offset + width;
        const box: TextPdfBox = [Math.max(min, drawing.box[0]) - offset, drawing.box[1], Math.min(max, drawing.box[2]) - offset, drawing.box[3]];
        const clip = sourcePieces.length > 1 ? `${number(min)} ${number(drawing.box[1])} ${number(max - min)} ${number(drawing.box[3] - drawing.box[1])} re W n` : '';
        const sourceScalars = [...sourcePieces[sourcePieces.length - 1 - j]];
        for (const scalar of sourceScalars.slice(1).reverse()) {
          const index = unusedMarks.findIndex(mark => mark.points.includes(scalar.codePointAt(0)!));
          if (index < 0) fail();
          const combined = unusedMarks[index];
          combined.points.splice(combined.points.indexOf(scalar.codePointAt(0)!), 1);
          // A combined mark outline is drawn once; each original mark still owns its Unicode mapping.
          const markDrawing = combined.drawn ? { box: [0, 0, 0, 0] as TextPdfBox, content: '' }
            : draw([combined.item], base.x + offset / scale);
          combined.drawn = true;
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
  function directionRuns(text: string, resolved?: ArrayLike<number>) {
    for (const scalar of text) {
      if (scalar.length !== 1 || /[\ufb00-\ufb06]/u.test(scalar) || !/^[\p{Script=Latin}\p{Script=Arabic}\p{Script=Common}\p{Script=Inherited}]$/u.test(scalar) || !font.hasGlyphForCodePoint(scalar.codePointAt(0)!)) fail();
    }
    const levels = resolved ?? [];
    if (!resolved) bidi.doBidiReorder(text, [], levels as number[]); // Plain Text PDF keeps its existing layout.
    if (levels.length !== text.length) fail();
    const runs: { text: string; rtl: boolean; start: number }[] = [];
    let previousGroup = '';
    const arabicNumber = /[\u0660-\u0669\u06f0-\u06f9]/u;
    for (let i = 0; i < text.length; i++) {
      const rtl = levels[i] % 2 === 1;
      // Readers apply bidi again to a Type3 mapping such as "٢٠٪."; isolate
      // Arabic numerals and percent signs from adjacent punctuation in logical order.
      const group = arabicNumber.test(text[i]) ? 'number' : text[i] === '\u066a' ? 'percent'
        : rtl && text[i] !== '-' && /[\p{P}\p{S}]/u.test(text[i]) ? 'punctuation' : String(rtl);
      if (!runs.length || previousGroup !== group) runs.push({ text: text[i], rtl, start: i });
      else runs[runs.length - 1].text += text[i];
      previousGroup = group;
    }
    // A neutral-only span inherits its neighbor's level, but has no RTL letters.
    for (const run of runs) if (/^[\p{P}\p{S}\s]+$/u.test(run.text)) run.rtl = false;
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
  function ensureSpace(height: number) { if (y + height > PAGE_HEIGHT - BOTTOM) { if (++pages > 20) fail(); pdf.addPage(); y = VERTICAL; } }
  function styledBlock(block: TextPdfBlock, style: StyledPdfStyle) {
    const embedding = (text: string) => styledBidi.getEmbeddingLevels(text, hasArabicLetters(text) ? style.direction : 'ltr');
    const available = PAGE_WIDTH - MARGIN * 2 - (block.kind === 'bullet' ? 12 : 0);
    type Run = { text: string; href?: string; bold: boolean; italic: boolean; color: string };
    const lines: Run[][] = [];
    let line: Run[] = [];
    const measure = (text: string) => directionRuns(text, embedding(text).levels).reduce((sum, run) => sum + shape(run.text, run.rtl).positions.reduce((width, pos) => width + pos.xAdvance, 0), 0) * scale * style.fontSize / 1000;
    const append = (text: string, source: Omit<Run, 'text'>) => {
      const last = line[line.length - 1];
      if (last && last.href === source.href && last.bold === source.bold && last.italic === source.italic && last.color === source.color) last.text += text;
      else line.push({ text, href: source.href, bold: source.bold, italic: source.italic, color: source.color });
    };
    const flush = () => { if (line.some(run => run.text.trim())) lines.push(line); line = []; };
    const fits = (text: string) => text.length <= 800 && measure(text) <= available;
    const atoms: Run[] = [];
    let sourceOffset = 0;
    for (const source of block.runs) {
      const end = sourceOffset + source.text.length;
      const boundaries = new Set([sourceOffset, end, ...(style.spacedBoundaries ?? []), ...(style.emphasis ?? []).flatMap(range => [range.start, range.end])]);
      const cuts = [...boundaries].filter(position => position >= sourceOffset && position <= end).sort((a, b) => a - b);
      for (let i = 0; i < cuts.length - 1; i++) {
        const start = cuts[i];
        const emphasis = style.emphasis?.find(range => range.start <= start && range.end > start);
        const atom = { text: ((style.spacedBoundaries ?? []).includes(start) ? ' ' : '') + source.text.slice(start - sourceOffset, cuts[i + 1] - sourceOffset),
          href: source.href, bold: emphasis?.bold ?? style.bold, italic: emphasis?.italic ?? style.italic, color: emphasis?.color ?? style.color };
        const previous = atoms[atoms.length - 1];
        if (previous && previous.href === atom.href && previous.bold === atom.bold && previous.italic === atom.italic && previous.color === atom.color) previous.text += atom.text;
        else atoms.push(atom);
      }
      sourceOffset = end;
    }
    const sourceText = atoms.map(atom => atom.text).join('');
    let atomOffset = 0;
    const sourceAtoms = atoms.map(atom => { const start = atomOffset; atomOffset += atom.text.length; return { ...atom, start, end: atomOffset }; });
    const appendSource = (start: number, end: number) => {
      for (const atom of sourceAtoms) {
        const from = Math.max(start, atom.start), to = Math.min(end, atom.end);
        if (from < to) append(sourceText.slice(from, to), atom);
      }
    };
    for (const match of sourceText.matchAll(/\r\n|[\n\r\t]|[^\S\r\n\t]+|\S+/gu)) {
        const token = match[0], start = match.index;
        if (/^[\r\n\t]/u.test(token)) { flush(); continue; }
        if (fits(line.map(run => run.text).join('') + token)) { appendSource(start, start + token.length); continue; }
        flush();
        if (fits(token)) { appendSource(start, start + token.length); continue; }
        for (const { segment, index } of graphemes.segment(token)) {
          if (!fits(line.map(run => run.text).join('') + segment)) { if (!line.length) fail(); flush(); }
          appendSource(start + index, start + index + segment.length);
        }
    }
    flush();
    const heading = block.kind === 'heading' || block.kind === 'title';
    if (heading) ensureSpace(Math.min(lines.length * style.lineHeight + style.spacingAfter + 24, PAGE_HEIGHT - VERTICAL * 2));
    const color = (value: string) => [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16) / 255);
    for (const [lineIndex, entries] of lines.entries()) {
      ensureSpace(heading && lineIndex === lines.length - 1 ? style.lineHeight + style.spacingAfter + 24 : style.lineHeight);
      const text = entries.map(run => run.text).join('');
      const resolved = embedding(text), levels = resolved.levels;
      const map = styledBidi.getReorderedIndices(text, resolved); // Visual positions only; source and mappings stay original.
      if (map.length !== text.length) fail();
      let offset = 0;
      const links = entries.map(entry => { const start = offset; offset += entry.text.length; return { ...entry, start, end: offset }; });
      const directional = directionRuns(text, levels).flatMap(run => /^[\u0660-\u0669\u06f0-\u06f9]+$/u.test(run.text) || (!run.rtl && levels[run.start] % 2 === 1)
        // Scalar objects preserve numeric source order and let each RTL neutral character take its visual position.
        ? [...run.text].map((scalar, index) => ({ text: scalar, rtl: false, start: run.start + index })) : [run]);
      const shapedRuns = directional.map(run => {
        const start = run.start, end = start + run.text.length, original = run.text;
        // Unicode bidi mirroring changes outlines, while mappings retain the original scalars.
        const drawing = [...original].map((scalar, index) => levels[start + index] % 2 === 1
          ? styledBidi.getMirroredCharacter(scalar) ?? scalar : scalar).join('');
        const shaped = piecesFor(drawing, run.rtl);
        const provenance = new Map<TextPdfPlacedPiece, number>();
        let offset = 0;
        for (const item of run.rtl ? [...shaped.placed].reverse() : shaped.placed) {
          if (!drawing.startsWith(item.piece.text, offset)) fail();
          provenance.set(item, start + offset);
          const source = original.slice(offset, offset + item.piece.text.length);
          offset += item.piece.text.length;
          item.piece = { ...item.piece, text: source };
        }
        if (offset !== original.length) fail();
        const rank = Math.min(...map.map((source, visual) => source >= start && source < end ? visual : Infinity));
        return { shaped, provenance, rank, rtl: run.rtl, left: 0 };
      });
      let width = 0;
      for (const run of [...shapedRuns].sort((a, b) => a.rank - b.rank)) { run.left = width; width += run.shaped.width * style.fontSize / 1000; }
      // Shaping precedes style/link cuts so Arabic joins, ligatures and marks retain their full-run positions.
      const segments = shapedRuns.flatMap(run => links.filter(link => link.href).flatMap(link => {
        const placed = run.shaped.placed.filter(item => { const source = run.provenance.get(item)!; return source >= link.start && source < link.end; });
        if (!placed.length) return [];
        const bounds = placed.map(item => {
          if (item.piece.width > 0) return [item.x, item.x + item.piece.width];
          const cluster = run.shaped.placed.filter(peer => peer.x === item.x);
          return [Math.min(...cluster.map(peer => peer.x + peer.piece.box[0])), Math.max(...cluster.map(peer => peer.x + Math.max(peer.piece.width, peer.piece.box[2])))];
        });
        const origin = Math.min(...bounds.map(box => box[0]));
        const width = Math.max(...bounds.map(box => box[1])) - origin;
        return [{ width, href: link.href, left: run.left + origin * style.fontSize / 1000 }];
      }));
      if (width > available + 0.1) fail();
      const left = style.align === 'right' ? PAGE_WIDTH - MARGIN - width - (block.kind === 'bullet' ? 12 : 0)
        : style.align === 'center' ? (PAGE_WIDTH - width) / 2 : MARGIN + (block.kind === 'bullet' ? 12 : 0);
      const styledPiece = (piece: TextPdfPiece, bold: boolean, italic: boolean) => {
        if (!bold && !italic) return piece;
        const shear = italic ? 0.16 : 0, stroke = bold ? 7.5 : 0;
        const [x0, y0, x1, y1] = piece.box;
        const box: TextPdfBox = [x0 + Math.min(shear * y0, shear * y1) - stroke, y0 - stroke, x1 + Math.max(shear * y0, shear * y1) + stroke, y1 + stroke];
        const drawing = piece.content.slice(piece.content.indexOf('\n') + 1);
        // Type3 d1 stays first. Outline styling cannot split a base/mark text object.
        return { ...piece, box, content: `${number(piece.width)} 0 ${box.map(number).join(' ')} d1\nq ${bold ? '15 w 1 J 1 j' : ''} 1 0 ${number(shear)} 1 0 0 cm\n${bold ? drawing.replace(/\nf(?=\s|$)/gu, '\nB') : drawing}\nQ` };
      };
      const placed = shapedRuns.flatMap(run => run.shaped.placed.map(item => {
        const source = run.provenance.get(item)!;
        const appearance = links.find(link => source >= link.start && source < link.end);
        if (!appearance) fail();
        return { x: run.left * 1000 / style.fontSize + item.x,
          piece: styledPiece(item.piece, appearance.bold, appearance.italic), color: appearance.color, rtl: run.rtl };
      }));
      const codes: { id: string; code: string }[] = [];
      // Distinct script fonts stop PDF.js coalescing short LTR mixed lines into one reversed item.
      // Reserve each direction for the full line so a font never changes inside an Arabic run.
      for (const rtl of [false, true]) {
        const indices = placed.flatMap((item, index) => item.rtl === rtl ? [index] : []);
        if (!indices.length) continue;
        const encoded = encodeRow(indices.map(index => placed[index]), rtl);
        indices.forEach((index, offset) => { codes[index] = encoded[offset]; });
      }
      const rgb = color(style.color);
      writer.write(`q ${rgb.map(number).join(' ')} rg ${rgb.map(number).join(' ')} RG`);
      // PDFium consumes one replacement for this complete line, rather than geometrically sorting its script fragments.
      // PDFium mirrors neutral punctuation in logical ActualText. Standard LRM hints
      // resolve its direction without changing glyph mappings or any visible source character.
      // Keep Latin identifiers/URLs intact by placing hints outside their complete token.
      const actualText = hasArabicLetters(text) ? text.replace(/\S+/gu, token => {
        if (!/\p{Bidi_Mirrored}/u.test(token)) return token;
        return hasArabicLetters(token) ? token.replace(/\p{Bidi_Mirrored}/gu, scalar => '\u200e' + scalar) : '\u200e' + token + '\u200e';
      }) : text;
      writer.write(`/Span << /ActualText <feff${hex(actualText)}> >> BDC`);
      let encodedIndex = 0;
      // Separate script objects keep pypdf from applying one bidi pass across unrelated runs.
      for (const run of shapedRuns) {
        const start = encodedIndex, origin = run.left * 1000 / style.fontSize;
        writer.write(`BT /${codes[start].id} ${number(style.fontSize)} Tf 1 0 0 1 ${number(left + run.left)} ${number(PAGE_HEIGHT - y - style.fontSize)} Tm`);
        let cursor = origin;
        let activeColor = '';
        let operators: string[] = [];
        const flush = () => { if (operators.length) writer.write(`[${operators.join(' ')}] TJ`); operators = []; };
        for (const item of run.shaped.placed) {
          const positioned = placed[encodedIndex];
          if (codes[encodedIndex].id !== codes[start].id) fail();
          if (activeColor !== positioned.color) {
            flush();
            activeColor = positioned.color;
            const rgb = color(activeColor);
            writer.write(`${rgb.map(number).join(' ')} rg ${rgb.map(number).join(' ')} RG`);
          }
          if (cursor !== positioned.x) operators.push(number(cursor - positioned.x));
          operators.push(`<${codes[encodedIndex++].code}>`);
          cursor = positioned.x + item.piece.width;
        }
        flush();
        writer.write('ET');
      }
      writer.write('EMC Q');
      for (const segment of segments) pdf.link(left + segment.left, y, segment.width * style.fontSize / 1000, style.lineHeight, { url: segment.href });
      if (block.kind === 'bullet' && lineIndex === 0) {
        pdf.setFillColor(style.color);
        pdf.circle(style.direction === 'rtl' ? PAGE_WIDTH - MARGIN - 3 : MARGIN + 3, y + style.fontSize * 0.65, 1.4, 'F');
      }
      y += style.lineHeight;
    }
    if (style.borderColor) { pdf.setDrawColor(style.borderColor); pdf.setLineWidth(0.6); pdf.line(MARGIN, y + 1, PAGE_WIDTH - MARGIN, y + 1); }
    y += style.spacingAfter;
  }
  for (const [blockIndex, block] of blocks.entries()) {
    if (styles) { styledBlock(block, styles[blockIndex]); continue; }
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
