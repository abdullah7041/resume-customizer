// src/lib/resumeText.js

const MIME_BY_EXTENSION = new Map([
  ["pdf", "application/pdf"],
  ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ["txt", "text/plain"],
]);

const normalizeExtension = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  const match = value.trim().toLowerCase().match(/\.([^.]+)$/);
  return match ? match[1] : "";
};

export const inferMimeType = ({ mimeType, fileName } = {}) => {
  if (typeof mimeType === "string" && mimeType.trim()) {
    const normalized = mimeType.trim().toLowerCase();
    const [primary] = normalized.split(";");
    return primary.trim();
  }
  const extension = normalizeExtension(fileName ?? "");
  return MIME_BY_EXTENSION.get(extension) ?? "application/octet-stream";
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
    const chunk = padded.slice(index, index + 2);
    bytes[index / 2] = parseInt(chunk, 16);
  }
  try {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    return decoder.decode(bytes);
  } catch {
    let fallback = "";
    for (const byte of bytes) {
      fallback += String.fromCharCode(byte);
    }
    return fallback;
  }
};

const extractPdfText = (arrayBuffer) => {
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
      const textPatterns = streamContent.matchAll(/\(([^)]+)\)/g);
      for (const textMatch of textPatterns) {
        const text = decodePdfEscapes(textMatch[1]).trim();
        if (text) {
          lines.push(text);
        }
      }
    }
  }

  return lines.join("\n");
};

export const extractPlainTextFromArrayBuffer = async (arrayBuffer, { mimeType, fileName } = {}) => {
  const inferredMime = inferMimeType({ mimeType, fileName });
  if (inferredMime === "application/pdf") {
    return extractPdfText(arrayBuffer);
  }
  try {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    return decoder.decode(arrayBuffer);
  } catch {
    return "";
  }
};

export const isPdfMimeType = (value) => inferMimeType({ mimeType: value }) === "application/pdf";

export const __internal = { decodePdfEscapes, decodeHexString, extractPdfText, arrayBufferToLatin1 };
