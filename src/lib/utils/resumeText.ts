const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const FALLBACK_OCTET_STREAM = "application/octet-stream";

interface FileInfo {
  mimeType?: string;
  fileName?: string;
}

const MIME_BY_EXTENSION = new Map([
  ["pdf", PDF_MIME],
  ["docx", DOCX_MIME],
  ["txt", "text/plain"],
]);

const normalizeExtension = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  const match = value.trim().toLowerCase().match(/\.([^.]+)$/);
  return match ? match[1] : "";
};

export const inferMimeType = ({ mimeType, fileName }: FileInfo = {}): string => {
  if (typeof mimeType === "string" && mimeType.trim()) {
    const normalized = mimeType.trim().toLowerCase();
    const [primary] = normalized.split(";");
    return primary.trim();
  }
  const extension = normalizeExtension(fileName ?? "");
  return MIME_BY_EXTENSION.get(extension) ?? FALLBACK_OCTET_STREAM;
};

const toArrayBuffer = (value) => {
  if (!value) {
    return null;
  }
  if (value instanceof ArrayBuffer) {
    return value;
  }
  if (ArrayBuffer.isView(value)) {
    const { buffer, byteOffset, byteLength } = value;
    return buffer.slice(byteOffset, byteOffset + byteLength);
  }
  return null;
};

const decodeUtf8 = (input) => {
  const arrayBuffer = toArrayBuffer(input);
  if (!arrayBuffer) {
    return "";
  }
  try {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    return decoder.decode(arrayBuffer);
  } catch {
    const view = new Uint8Array(arrayBuffer);
    let fallback = "";
    for (const byte of view) {
      fallback += String.fromCharCode(byte);
    }
    return fallback;
  }
};

let pdfjsLibPromise;

const loadPdfjs = async () => {
  if (pdfjsLibPromise !== undefined) {
    return pdfjsLibPromise;
  }
  pdfjsLibPromise = import("pdfjs-dist/legacy/build/pdf.mjs")
    .then((module) => {
      if (module?.GlobalWorkerOptions) {
        module.GlobalWorkerOptions.workerSrc = "";
        module.GlobalWorkerOptions.workerPort = null;
      }
      return module;
    })
    .catch(() => null);
  return pdfjsLibPromise;
};

interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LineInfo {
  text: string;
  y: number;
  fontSize: number;
  fillRight: number; // right edge of contiguous text, ignoring a right-aligned tail
  rightEdge: number; // absolute right edge of the line
  hasBullet: boolean;
}

const Y_ROW_THRESHOLD = 5;

// Soft-wrap merge tuning. A wrapped continuation line has no bullet, sits one
// line-height below a line that filled to the right margin, and is rejoined to it.
const WRAP_GAP_FACTOR = 1.8; // continuation gap vs font size (paragraph gaps are larger)
const FULL_LINE_MARGIN = 60; // how close to the right edge counts as "filled"
const FILL_GAP = 40; // a horizontal gap this large marks a right-aligned tail (e.g. a date)
const BULLET_LINE = /^[•·▪◦‣∙]/u;

// Column-detection tuning. Conservative on purpose: a false column split scrambles
// a common single-column layout (right-aligned dates), so we only split when there
// are two clearly independent text columns.
const MIN_ITEMS_FOR_COLUMNS = 12; // too few items → treat as single column
const MIN_COLUMN_ITEMS = 5; // each column must carry real content
const MIN_COLUMN_ITEM_RATIO = 0.3; // reject lopsided splits (e.g. a thin date column)
const MIN_VERTICAL_COVERAGE = 0.45; // each column must span ~half the content height
const MIN_VERTICAL_OVERLAP = 0.4; // columns must coexist vertically
const GUTTER_MIN_FRACTION = 0.05; // gutter width vs page width
const GUTTER_MIN_ABSOLUTE = 15; // gutter width floor in PDF units
const LOW_COVERAGE_FRACTION = 0.1; // a gutter is a low-coverage vertical strip
const ROW_PAIRING_REJECT = 0.6; // if most right items share a row with a left item,
//                                  it's right-aligned content, not a real column

/**
 * Band items into physical rows: sort top→bottom (descending Y, since PDF Y=0 is
 * page bottom) then left→right, group by Y proximity, and join each row by X with
 * gap-based spacing. PDF.js already applies bidi to item.str, so RTL scripts
 * (Arabic) are visually ordered within each item — we preserve that by not reversing.
 */
const buildLinesFromItems = (items: PdfTextItem[]): LineInfo[] => {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: LineInfo[] = [];
  let rowItems: PdfTextItem[] = [];
  let rowY = sorted[0].y;

  const flushRow = () => {
    if (rowItems.length === 0) return;
    rowItems.sort((a, b) => a.x - b.x);
    let text = "";
    let prevEnd = -Infinity;
    let fillRight = -Infinity;
    let rightEdge = -Infinity;
    let fontSize = 0;
    let sawBigGap = false;
    for (const { str, x, width, height } of rowItems) {
      if (prevEnd > -Infinity && x > prevEnd + 2) {
        text += " ";
        // A wide gap means a right-aligned tail (date); freeze the contiguous edge.
        if (!sawBigGap && x - prevEnd > FILL_GAP) {
          fillRight = prevEnd;
          sawBigGap = true;
        }
      }
      text += str;
      const end = x + width;
      prevEnd = Math.max(prevEnd, end);
      if (end > rightEdge) rightEdge = end;
      if (!sawBigGap) fillRight = prevEnd;
      if (height > fontSize) fontSize = height;
    }
    const trimmed = text.replace(/\s+/g, " ").trim();
    if (trimmed.length > 0) {
      lines.push({
        text: trimmed,
        y: rowY,
        fontSize,
        fillRight: fillRight === -Infinity ? rightEdge : fillRight,
        rightEdge: rightEdge === -Infinity ? 0 : rightEdge,
        hasBullet: BULLET_LINE.test(trimmed),
      });
    }
    rowItems = [];
  };

  for (const it of sorted) {
    if (Math.abs(it.y - rowY) > Y_ROW_THRESHOLD) {
      flushRow();
      rowY = it.y;
    }
    rowItems.push(it);
  }
  flushRow();

  return lines;
};

/**
 * Rejoin soft-wrapped continuation lines. A continuation has no bullet of its own,
 * follows a line that filled to the right margin, and sits within one line-height.
 * This stops a single wrapped bullet from becoming several bullets downstream
 * (and stops words like "Power BI" splitting across the wrap). Hyphenated wraps
 * ("Data-" + "Driven") join without a space; everything else joins with one.
 */
const mergeWrappedLines = (lines: LineInfo[]): LineInfo[] => {
  if (lines.length < 2) return lines;

  let maxRight = 0;
  for (const line of lines) if (line.rightEdge > maxRight) maxRight = line.rightEdge;
  const fullThreshold = maxRight - FULL_LINE_MARGIN;

  const merged: LineInfo[] = [];
  for (const line of lines) {
    const prev = merged[merged.length - 1];
    const gap = prev ? prev.y - line.y : 0;
    const isWrap =
      prev &&
      !line.hasBullet &&
      prev.fillRight >= fullThreshold &&
      gap > 0 &&
      line.fontSize > 0 &&
      gap <= WRAP_GAP_FACTOR * line.fontSize;

    if (isWrap) {
      const joiner = /[\p{L}]-$/u.test(prev.text) ? "" : " ";
      prev.text = `${prev.text}${joiner}${line.text}`;
      prev.y = line.y;
      prev.fontSize = line.fontSize;
      prev.fillRight = line.fillRight;
      prev.rightEdge = line.rightEdge;
      continue;
    }
    merged.push({ ...line });
  }

  return merged;
};

const renderLines = (lines: LineInfo[]): string => lines.map((line) => line.text).join("\n");

/**
 * Find a vertical gutter that splits the page into two columns. Builds a coverage
 * histogram across X (counting how many items cross each vertical strip), then looks
 * for the widest internal low-coverage valley with dense text on both sides. Returns
 * the split X position, or null when the page is single-column. A full-width header
 * crossing the gutter adds only a little coverage, so the valley still shows.
 */
const detectColumnSplit = (items: PdfTextItem[]): number | null => {
  if (items.length < MIN_ITEMS_FOR_COLUMNS) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  for (const it of items) {
    if (it.x < minX) minX = it.x;
    const right = it.x + it.width;
    if (right > maxX) maxX = right;
  }
  const pageWidth = maxX - minX;
  if (!(pageWidth > 0)) return null;

  const binCount = Math.max(1, Math.round(pageWidth));
  const coverage = new Array<number>(binCount).fill(0);
  for (const it of items) {
    const start = Math.max(0, Math.floor(it.x - minX));
    const end = Math.min(binCount, Math.ceil(it.x - minX + Math.max(it.width, 1)));
    for (let bin = start; bin < end; bin += 1) coverage[bin] += 1;
  }

  let peak = 0;
  for (const count of coverage) if (count > peak) peak = count;
  if (peak === 0) return null;
  const lowThreshold = peak * LOW_COVERAGE_FRACTION;

  // Bounds of the dense region, so leading/trailing margins aren't treated as a gutter.
  let firstDense = -1;
  let lastDense = -1;
  for (let bin = 0; bin < binCount; bin += 1) {
    if (coverage[bin] > lowThreshold) {
      if (firstDense === -1) firstDense = bin;
      lastDense = bin;
    }
  }
  if (firstDense === -1 || lastDense <= firstDense) return null;

  // Longest low-coverage run strictly inside the dense region.
  let bestStart = -1;
  let bestLen = 0;
  let runStart = -1;
  for (let bin = firstDense + 1; bin < lastDense; bin += 1) {
    if (coverage[bin] <= lowThreshold) {
      if (runStart === -1) runStart = bin;
    } else if (runStart !== -1) {
      const len = bin - runStart;
      if (len > bestLen) {
        bestLen = len;
        bestStart = runStart;
      }
      runStart = -1;
    }
  }
  if (runStart !== -1) {
    const len = lastDense - runStart;
    if (len > bestLen) {
      bestLen = len;
      bestStart = runStart;
    }
  }

  const minGutter = Math.max(GUTTER_MIN_ABSOLUTE, pageWidth * GUTTER_MIN_FRACTION);
  if (bestStart === -1 || bestLen < minGutter) return null;

  const splitOffset = bestStart + bestLen / 2;
  const splitFraction = splitOffset / pageWidth;
  if (splitFraction < 0.2 || splitFraction > 0.8) return null;

  return minX + splitOffset;
};

const verticalRange = (items: PdfTextItem[]): [number, number] => {
  let min = Infinity;
  let max = -Infinity;
  for (const it of items) {
    if (it.y < min) min = it.y;
    if (it.y > max) max = it.y;
  }
  return [min, max];
};

/**
 * Confirm a proposed split is two real columns and not right-aligned content in a
 * single column. Rejects when either side is thin, the sides don't overlap
 * vertically, or most right-side items share a row with a left-side item (the
 * signature of right-aligned dates that must stay on the title's line).
 */
const isValidColumnSplit = (left: PdfTextItem[], right: PdfTextItem[]): boolean => {
  if (left.length < MIN_COLUMN_ITEMS || right.length < MIN_COLUMN_ITEMS) return false;

  const ratio = Math.min(left.length, right.length) / Math.max(left.length, right.length);
  if (ratio < MIN_COLUMN_ITEM_RATIO) return false;

  const [lMin, lMax] = verticalRange(left);
  const [rMin, rMax] = verticalRange(right);
  const contentHeight = Math.max(lMax, rMax) - Math.min(lMin, rMin);
  if (!(contentHeight > 0)) return false;

  const lHeight = lMax - lMin;
  const rHeight = rMax - rMin;
  if (lHeight / contentHeight < MIN_VERTICAL_COVERAGE) return false;
  if (rHeight / contentHeight < MIN_VERTICAL_COVERAGE) return false;

  const overlap = Math.min(lMax, rMax) - Math.max(lMin, rMin);
  const minHeight = Math.min(lHeight, rHeight);
  if (minHeight <= 0 || overlap / minHeight < MIN_VERTICAL_OVERLAP) return false;

  let paired = 0;
  for (const r of right) {
    if (left.some((l) => Math.abs(l.y - r.y) <= Y_ROW_THRESHOLD)) paired += 1;
  }
  if (paired / right.length > ROW_PAIRING_REJECT) return false;

  return true;
};

/**
 * Collect PDF page text while preserving reading order. Single-column pages band
 * straight into rows. Two-column pages (skills sidebars, timeline layouts) are read
 * one full column at a time so left- and right-column lines aren't merged into one.
 * Transform matrix: [scaleX, skewX, skewY, scaleY, translateX(x), translateY(y)].
 */
const collectPdfPageText = (contentItems) => {
  if (!contentItems || contentItems.length === 0) return "";

  const items: PdfTextItem[] = [];
  for (const item of contentItems) {
    if (typeof item?.str !== "string" || !item.str) continue;
    const transform = Array.isArray(item.transform) ? item.transform : [];
    const x = typeof transform[4] === "number" ? transform[4] : 0;
    const y = typeof transform[5] === "number" ? transform[5] : 0;
    const skewY = typeof transform[1] === "number" ? transform[1] : 0;
    const scaleY = typeof transform[3] === "number" ? transform[3] : 0;
    const height = Math.hypot(skewY, scaleY);
    const width = typeof item.width === "number" && item.width >= 0 ? item.width : 0;
    items.push({ str: item.str, x, y, width, height });
  }

  if (items.length === 0) return "";

  const split = detectColumnSplit(items);
  if (split !== null) {
    const left: PdfTextItem[] = [];
    const right: PdfTextItem[] = [];
    for (const it of items) {
      const spansGutter = it.x < split && it.x + it.width > split;
      const center = it.x + it.width / 2;
      // Full-width items (headers) go to the left column so they read above both.
      if (spansGutter || center < split) left.push(it);
      else right.push(it);
    }
    if (isValidColumnSplit(left, right)) {
      const leftText = renderLines(mergeWrappedLines(buildLinesFromItems(left)));
      const rightText = renderLines(mergeWrappedLines(buildLinesFromItems(right)));
      return [leftText, rightText].filter(Boolean).join("\n");
    }
  }

  return renderLines(mergeWrappedLines(buildLinesFromItems(items)));
};

const MIN_READABLE_TEXT_LENGTH = 100;

/**
 * Normalize extracted resume text generically (no resume-specific rules):
 * collapse repeated bullet glyphs and whitespace runs, strip page-break noise
 * (Page N / N of M / N/M), and collapse excess blank lines. Safe for both
 * Latin and Arabic content — only touches symbol/whitespace artifacts.
 */
export const normalizeResumeText = (text) => {
  if (typeof text !== "string" || !text) return "";
  const cleaned = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw
      .replace(/[•·▪◦‣∙]{2,}/g, "•") // collapse repeated bullet glyph runs
      .replace(/[ \t]{2,}/g, " ") // collapse runs of spaces/tabs
      .replace(/\s+$/g, ""); // trailing whitespace
    // Drop page-break noise: "Page 1", "Page 1 of 3", "1 / 3". Never bare years.
    if (/^\s*(page\s+\d+(\s+of\s+\d+)?|\d{1,3}\s*\/\s*\d{1,3})\s*$/i.test(line)) {
      continue;
    }
    cleaned.push(line);
  }
  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
};

/**
 * Classify extraction quality into one of four stable states so callers can
 * return precise errors instead of generic failures.
 *  - 'empty'     : no selectable text at all.
 *  - 'too-short' : some text but below the minimum needed to parse.
 *  - 'cid-glyph' : enough characters but fails word-level readability (CID-font /
 *                  scanned-glyph garbage — isolated "letters" between symbols).
 *  - 'readable'  : usable resume text.
 */
export const classifyExtraction = (text) => {
  if (typeof text !== "string" || text.trim().length === 0) return "empty";
  const trimmed = text.trim();
  if (trimmed.length < MIN_READABLE_TEXT_LENGTH) return "too-short";
  const sample = trimmed.substring(0, 500);
  const words = sample
    .split(/[\s,;:.!?(){}\[\]|/\\]+/) // eslint-disable-line no-useless-escape
    .filter((w) => /^[\p{L}]{2,}$/u.test(w));
  const readable = words.length >= 5 && words.length / sample.length > 0.02;
  return readable ? "readable" : "cid-glyph";
};

const arrayBufferToLatin1 = (arrayBuffer) => {
  const view = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  let result = "";
  for (let offset = 0; offset < view.length; offset += chunkSize) {
    const chunk = view.subarray(offset, Math.min(offset + chunkSize, view.length));
    result += String.fromCharCode(...chunk);
  }
  return result;
};

const decodePdfEscapes = (value) =>
  value
    .replace(/\\([nrtbf\\()])/g, (_match, char) => {
      switch (char) {
        case "n":
          return "\n";
        case "r":
          return "\r";
        case "t":
          return "\t";
        case "b":
          return "\b";
        case "f":
          return "\f";
        case "(":
          return "(";
        case ")":
          return ")";
        case "\\":
          return "\\";
        default:
          return char;
      }
    })
    .replace(/\\([0-7]{1,3})/g, (_match, octal) => String.fromCharCode(parseInt(octal, 8)));

const decodeHexString = (hex) => {
  const clean = hex.replace(/\s+/g, "");
  const padded = clean.length % 2 === 1 ? `${clean}0` : clean;
  const bytes = new Uint8Array(padded.length / 2);
  for (let index = 0; index < padded.length; index += 2) {
    bytes[index / 2] = parseInt(padded.slice(index, index + 2), 16);
  }
  return decodeUtf8(bytes);
};

const extractPdfTextFallback = (arrayBuffer) => {
  if (!arrayBuffer) return "";
  const content = arrayBufferToLatin1(arrayBuffer);
  const blocks = Array.from(content.matchAll(/BT[\s\S]*?ET/g));
  const lines = [];

  for (const block of blocks) {
    const segment = block[0];
    const textChunks = [];
    const stringMatches = segment.matchAll(/\((?:\\.|[^\\)])*\)/g);
    for (const match of stringMatches) {
      const inner = match[0].slice(1, -1);
      textChunks.push(decodePdfEscapes(inner));
    }
    const hexMatches = segment.matchAll(/<([0-9A-Fa-f\s]+)>/g);
    for (const match of hexMatches) {
      textChunks.push(decodeHexString(match[1]));
    }
    const line = textChunks
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (line) {
      lines.push(line);
    }
  }

  if (lines.length === 0) {
    const streamMatches = content.matchAll(/stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g);
    for (const match of streamMatches) {
      const streamContent = match[1];
      const textPatterns = streamContent.matchAll(/\((?:\\.|[^\\)])+\)/g);
      for (const textMatch of textPatterns) {
        const text = decodePdfEscapes(textMatch[0].slice(1, -1)).trim();
        if (text) {
          lines.push(text);
        }
      }
    }
  }

  return lines.join("\n");
};

const extractPdfPlainText = async (arrayBuffer) => {
  const pdfjs = await loadPdfjs();
  if (pdfjs) {
    try {
      const document = await pdfjs.getDocument({
        data: arrayBuffer,
        disableWorker: true,
        cMapUrl: "https://unpkg.com/pdfjs-dist@5.4.394/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "https://unpkg.com/pdfjs-dist@5.4.394/standard_fonts/",
      }).promise;
      const lines = [];

      try {
        for (let pageIndex = 1; pageIndex <= document.numPages; pageIndex += 1) {
          const page = await document.getPage(pageIndex);
          try {
            const content = await page.getTextContent();
            const text = collectPdfPageText(content.items ?? []);
            if (text) {
              lines.push(text);
            }
          } finally {
            if (typeof page.cleanup === "function") {
              page.cleanup();
            }
          }
        }
      } finally {
        if (typeof document.cleanup === "function") {
          document.cleanup();
        }
        if (typeof document.destroy === "function") {
          document.destroy();
        }
      }

      if (lines.length > 0) {
        return lines.join("\n");
      }
    } catch {
      // fall back to manual parsing below
    }
  }

  return extractPdfTextFallback(arrayBuffer);
};

const ZIP_END_SIGNATURE = new Uint8Array([0x50, 0x4b, 0x05, 0x06]);
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_SIGNATURE = 0x04034b50;
const MAX_DOCX_COMPRESSED_XML_BYTES = 2 * 1024 * 1024;
const MAX_DOCX_INFLATED_XML_BYTES = 5 * 1024 * 1024;

const equalsSignature = (bytes, offset, signature) => {
  if (offset < 0 || offset + signature.length > bytes.length) {
    return false;
  }
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[offset + index] !== signature[index]) {
      return false;
    }
  }
  return true;
};

const inflateWithNode = async (bytes) => {
  if (typeof process !== "undefined" && process?.versions?.node && typeof Buffer === "function") {
    try {
      const { inflateRawSync } = await import("node:zlib");
      const buffer = Buffer.from(bytes);
      const inflated = inflateRawSync(buffer, { maxOutputLength: MAX_DOCX_INFLATED_XML_BYTES });
      return new Uint8Array(inflated.buffer, inflated.byteOffset, inflated.byteLength);
    } catch {
      return null;
    }
  }
  return null;
};

const inflateWithStream = async (bytes) => {
  if (typeof DecompressionStream !== "function") {
    return null;
  }

  try {
    const stream = new DecompressionStream("deflate-raw");
    const writer = stream.writable.getWriter();
    await writer.write(bytes);
    await writer.close();

    const reader = stream.readable.getReader();
    const chunks = [];
    let total = 0;

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(value);
        total += value.length;
        if (total > MAX_DOCX_INFLATED_XML_BYTES) {
          throw new Error("DOCX document.xml exceeds size limit");
        }
      }
    }

    const output = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.length;
    }
    return output;
  } catch {
    return null;
  }
};

const inflateDocxData = async (bytes) => {
  const fromNode = await inflateWithNode(bytes);
  if (fromNode) {
    return fromNode;
  }
  const fromStream = await inflateWithStream(bytes);
  if (fromStream) {
    return fromStream;
  }
  return null;
};

const decodeEntities = (value) =>
  value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

const decodeXmlParagraphs = (xml) => {
  const paragraphs = Array.from(xml.matchAll(/<w:p[\s\S]*?<\/w:p>/gi));
  const lines = paragraphs
    .map((match) => match[0])
    .map((paragraph) => {
      const hasBullet = /w:numPr/.test(paragraph) || /ListParagraph/i.test(paragraph);
      const text = decodeEntities(
        paragraph
          .replace(/<w:tab[^>]*\/>/gi, "\t")
          .replace(/<w:br[^>]*\/>/gi, "\n")
          .replace(/<[^>]+>/g, " ")
      )
        .replace(/\s+/g, " ")
        .trim();

      if (!text) {
        return null;
      }

      return hasBullet ? `• ${text}` : text;
    })
    .filter((line) => Boolean(line));

  if (lines.length > 0) {
    return lines.join("\n");
  }

  return decodeEntities(
    xml
      .replace(/<w:p[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
};

const findDocumentXml = async (arrayBuffer) => {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);

  for (let index = bytes.length - ZIP_END_SIGNATURE.length; index >= 0; index -= 1) {
    if (!equalsSignature(bytes, index, ZIP_END_SIGNATURE)) {
      continue;
    }

    const centralDirEntries = view.getUint16(index + 10, true);
    const centralDirOffset = view.getUint32(index + 16, true);
    let offset = centralDirOffset;

    for (let entry = 0; entry < centralDirEntries; entry += 1) {
      if (view.getUint32(offset, true) !== ZIP_CENTRAL_SIGNATURE) {
        break;
      }

      const compression = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const uncompressedSize = view.getUint32(offset + 24, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const fileNameStart = offset + 46;
      const fileNameEnd = fileNameStart + nameLength;
      const fileNameBytes = bytes.subarray(fileNameStart, fileNameEnd);
      const fileName = decodeUtf8(fileNameBytes);
      const localHeaderOffset = view.getUint32(offset + 42, true);

      if (fileName === "word/document.xml") {
        if (view.getUint32(localHeaderOffset, true) !== ZIP_LOCAL_SIGNATURE) {
          return "";
        }
        const localNameLength = view.getUint16(localHeaderOffset + 26, true);
        const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
        const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
        const dataEnd = dataStart + compressedSize;
        const compressed = bytes.subarray(dataStart, dataEnd);

        if (
          compressedSize > MAX_DOCX_COMPRESSED_XML_BYTES ||
          uncompressedSize > MAX_DOCX_INFLATED_XML_BYTES
        ) {
          return "";
        }

        if (compression === 0) {
          return decodeUtf8(compressed);
        }
        if (compression === 8) {
          const inflated = await inflateDocxData(compressed);
          if (!inflated) {
            return "";
          }
          return decodeUtf8(inflated);
        }
        throw new Error("Unsupported DOCX compression method");
      }

      offset += 46 + nameLength + extraLength + commentLength;
    }
  }

  return "";
};

const extractDocxPlainText = async (arrayBuffer) => {
  try {
    const xml = await findDocumentXml(arrayBuffer);
    if (!xml) {
      return "";
    }
    return decodeXmlParagraphs(xml);
  } catch {
    return "";
  }
};

export const extractPlainTextFromArrayBuffer = async (input: ArrayBuffer | ArrayBufferView | null | undefined, { mimeType, fileName }: FileInfo = {}): Promise<string> => {
  const arrayBuffer = toArrayBuffer(input);
  if (!arrayBuffer) {
    return "";
  }

  const inferredMime = inferMimeType({ mimeType, fileName });

  if (inferredMime === PDF_MIME) {
    return normalizeResumeText(await extractPdfPlainText(arrayBuffer));
  }

  if (inferredMime === DOCX_MIME) {
    return normalizeResumeText(await extractDocxPlainText(arrayBuffer));
  }

  return normalizeResumeText(decodeUtf8(arrayBuffer));
};

export const isPdfMimeType = (value) => inferMimeType({ mimeType: value }) === PDF_MIME;

export const __internal = {
  decodePdfEscapes,
  decodeHexString,
  extractPdfTextFallback,
  arrayBufferToLatin1,
  collectPdfPageText,
  normalizeResumeText,
  classifyExtraction,
};




