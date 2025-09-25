import type { Handler } from "@netlify/functions";
import { inflateRawSync } from "node:zlib";
import { buildResumeDocument } from "../../shared/normalize-resume.js";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
} as const;

type ParseResumeRequest =
  | {
      kind: "text";
      value?: string;
    }
  | {
      kind: "file";
      name?: string;
      mime?: string;
      data?: string;
    };

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB safety guard

const decodeBase64 = (value: string): Buffer => {
  try {
    return Buffer.from(value, "base64");
  } catch {
    throw new Error("Invalid file encoding.");
  }
};

const decodePdfEscapes = (value: string): string =>
  value
    .replace(/\\([nrtbf\\()])/g, (_, char: string) => {
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
    .replace(/\\([0-7]{1,3})/g, (_, octal: string) => String.fromCharCode(parseInt(octal, 8)));

const decodeHexString = (hex: string): string => {
  const clean = hex.replace(/\s+/g, "");
  if (clean.length % 2 === 1) {
    return Buffer.from(`${clean}0`, "hex").toString("utf8");
  }
  return Buffer.from(clean, "hex").toString("utf8");
};

const extractPdfText = async (buffer: Buffer): Promise<string> => {
  const content = buffer.toString("latin1");
  const blocks = Array.from(content.matchAll(/BT[\s\S]*?ET/g));
  const lines: string[] = [];

  for (const block of blocks) {
    const segment = block[0];
    const textChunks: string[] = [];
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

  return lines.join("\n");
};

const decodeEntities = (value: string): string =>
  value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

const findDocumentXml = (buffer: Buffer): string | null => {
  const signature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  for (let i = buffer.length - signature.length; i >= 0; i--) {
    if (buffer.slice(i, i + 4).equals(signature)) {
      const centralDirOffset = buffer.readUInt32LE(i + 16);
      const totalEntries = buffer.readUInt16LE(i + 10);
      let offset = centralDirOffset;
      for (let entry = 0; entry < totalEntries; entry++) {
        const headerSig = buffer.readUInt32LE(offset);
        if (headerSig !== 0x02014b50) {
          break;
        }
        const compression = buffer.readUInt16LE(offset + 10);
        const compressedSize = buffer.readUInt32LE(offset + 20);
        const nameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        const fileName = buffer
          .slice(offset + 46, offset + 46 + nameLength)
          .toString("utf8");
        const localHeaderOffset = buffer.readUInt32LE(offset + 42);

        if (fileName === "word/document.xml") {
          const localSig = buffer.readUInt32LE(localHeaderOffset);
          if (localSig !== 0x04034b50) {
            return null;
          }
          const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
          const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
          const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
          const compressed = buffer.slice(dataStart, dataStart + compressedSize);
          if (compression === 0) {
            return compressed.toString("utf8");
          }
          if (compression === 8) {
            return inflateRawSync(compressed).toString("utf8");
          }
          throw new Error("Unsupported DOCX compression method");
        }

        offset += 46 + nameLength + extraLength + commentLength;
      }
      break;
    }
  }
  return null;
};

const extractDocxText = async (buffer: Buffer): Promise<string> => {
  const xml = findDocumentXml(buffer);
  if (!xml) {
    return "";
  }
  const paragraphs = Array.from(xml.matchAll(/<w:p[\s\S]*?<\/w:p>/gi));
  const lines = paragraphs
    .map((match) => match[0])
    .map((paragraph) => {
      const hasBullet = /w:numPr/.test(paragraph) || /ListParagraph/i.test(paragraph);
      const text = decodeEntities(
        paragraph
          .replace(/<w:tab[^>]*\/>/gi, " \t ")
          .replace(/<w:br[^>]*\/>/gi, "\n")
          .replace(/<[^>]+>/g, " ")
      )
        .replace(/\s+/g, " ")
        .trim();
      if (!text) return null;
      return hasBullet ? `• ${text}` : text;
    })
    .filter((line): line is string => Boolean(line));

  if (lines.length === 0) {
    return decodeEntities(
      xml
        .replace(/<w:p[^>]*>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );
  }

  return lines.join("\n");
};

const inferType = (payload: { mime?: string; name?: string }): string => {
  const { mime, name } = payload;
  if (mime) return mime;
  if (!name) return "";
  const lowered = name.toLowerCase();
  if (lowered.endsWith(".pdf")) return "application/pdf";
  if (lowered.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "";
};

const extractText = async (body: ParseResumeRequest): Promise<string> => {
  if (body.kind === "text") {
    return typeof body.value === "string" ? body.value : "";
  }

  if (body.kind === "file") {
    if (!body.data) {
      throw new Error("File payload missing content.");
    }
    const buffer = decodeBase64(body.data);
    if (!buffer.byteLength) {
      throw new Error("File payload was empty.");
    }
    if (buffer.byteLength > MAX_BYTES) {
      throw new Error("File exceeds the maximum supported size (8 MB).");
    }
    const type = inferType(body);
    switch (type) {
      case "application/pdf":
        return extractPdfText(buffer);
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return extractDocxText(buffer);
      default:
        throw new Error("Unsupported file type. Upload PDF or DOCX.");
    }
  }

  throw new Error("Invalid parse request.");
};

const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: HEADERS,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const body: ParseResumeRequest = event.body ? JSON.parse(event.body) : { kind: "text", value: "" };
    const text = await extractText(body);
    const normalized = buildResumeDocument(text);

    if (!normalized.plainText || normalized.plainText.trim().length === 0) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ error: "Unable to extract readable text from the resume." }),
      };
    }

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ document: normalized }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to parse resume.";
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ error: message }),
    };
  }
};

export { handler };
