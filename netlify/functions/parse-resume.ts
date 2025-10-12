import type { Handler } from "@netlify/functions";
import { buildResumeDocument } from "../../shared/normalize-resume.js";
import {
  extractPlainTextFromArrayBuffer,
  inferMimeType,
} from "../../src/lib/resumeText.js";

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

const decodeBase64 = (value: string): ArrayBuffer => {
  try {
    const buffer = Buffer.from(value, "base64");
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  } catch {
    throw new Error("Invalid file encoding.");
  }
};

const extractText = async (body: ParseResumeRequest): Promise<string> => {
  if (body.kind === "text") {
    return typeof body.value === "string" ? body.value : "";
  }

  if (body.kind === "file") {
    if (!body.data) {
      throw new Error("File payload missing content.");
    }

    const arrayBuffer = decodeBase64(body.data);
    if (!arrayBuffer.byteLength) {
      throw new Error("File payload was empty.");
    }
    if (arrayBuffer.byteLength > MAX_BYTES) {
      throw new Error("File exceeds the maximum supported size (8 MB).");
    }

    const mimeType = inferMimeType({ mimeType: body.mime, fileName: body.name });
    return extractPlainTextFromArrayBuffer(arrayBuffer, {
      mimeType,
      fileName: body.name,
    });
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
        body: JSON.stringify({
          error:
            "Unable to extract readable text from the resume. Please ensure your PDF contains selectable text (not scanned images). Try uploading a different format or pasting the text directly.",
        }),
      };
    }

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ document: normalized }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to parse resume.";
    const userMessage = message.includes("Unsupported")
      ? "Unsupported file type. Please upload a PDF or DOCX file, or paste your resume text directly."
      : message.includes("exceeds")
      ? "File is too large. Please use a file smaller than 8 MB."
      : `Unable to parse resume: ${message}`;

    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ error: userMessage }),
    };
  }
};

export { handler };
