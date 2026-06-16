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

/**
 * Collect PDF page text while preserving reading order.
 * Groups items into lines by Y-coordinate, then sorts each line's items by their
 * X-coordinate (transform[4]) so out-of-stream-order glyph runs reconstruct
 * left-to-right reading order. PDF.js already applies bidi to item.str, so RTL
 * scripts (Arabic) are already visually ordered within each item.
 * Transform matrix: [scaleX, skewX, skewY, scaleY, translateX(x), translateY(y)].
 * @param {Array} contentItems - Array of PDF.js text content items
 * @returns {string} - Extracted text with preserved line structure
 */
const collectPdfPageText = (contentItems) => {
  if (!contentItems || contentItems.length === 0) return "";

  const lines = [];
  let currentLine = []; // array of { str, x }
  let lastY = null;
  const Y_THRESHOLD = 5; // Pixels threshold to detect new line

  const flushLine = () => {
    if (currentLine.length === 0) return;
    const ordered = currentLine
      .slice()
      .sort((a, b) => a.x - b.x)
      .map((entry) => entry.str)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (ordered.length > 0) lines.push(ordered);
    currentLine = [];
  };

  for (const item of contentItems) {
    if (typeof item?.str !== "string" || !item.str) continue;

    const currentX = typeof item.transform?.[4] === "number" ? item.transform[4] : 0;
    const currentY = item.transform?.[5];

    // If Y coordinate changed significantly, it's a new line.
    if (lastY !== null && currentY !== undefined && Math.abs(currentY - lastY) > Y_THRESHOLD) {
      flushLine();
    }

    currentLine.push({ str: item.str, x: currentX });
    if (currentY !== undefined) {
      lastY = currentY;
    }
  }

  flushLine();

  return lines.filter((line) => line.length > 0).join("\n");
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




