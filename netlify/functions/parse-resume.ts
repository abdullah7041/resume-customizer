import type { Handler } from "@netlify/functions";
import { buildResumeDocument } from "../lib/normalize-resume.js";
import {
  extractPlainTextFromArrayBuffer,
  inferMimeType,
} from "../lib/resumeText.js";
import { withRateLimit } from "../lib/rate-limiter.js";
import { initSentry, captureError } from "../lib/sentry.js";

initSentry();

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
} as const;

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
]);

const SUPPORTED_FILE_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

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

class UnreadableResumeError extends Error {
  statusCode = 422;

  constructor(message = "Could not extract readable text from the uploaded file. Please upload a text-based PDF/DOCX/TXT file or paste your resume text directly.") {
    super(message);
    this.name = "UnreadableResumeError";
  }
}

const decodeBase64 = (value: string): ArrayBuffer => {
  try {
    const buffer = Buffer.from(value, "base64");
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  } catch {
    throw new Error("Invalid file encoding.");
  }
};

/**
 * Common resume keywords that should appear in legitimate resumes
 * Used to validate extraction quality
 */
const RESUME_INDICATORS = [
  'experience', 'education', 'skills', 'work', 'university', 'college',
  'bachelor', 'master', 'degree', 'project', 'developed', 'managed',
  'leadership', 'team', 'certification', 'proficient', 'expert',
  'responsible', 'achieved', 'implemented', 'designed', 'analyzed'
];

/**
 * Calculate character entropy to detect repetitive/garbled text
 * High entropy = diverse characters (good)
 * Low entropy = repetitive patterns like "I I I I" (bad)
 */
const calculateEntropy = (text: string): number => {
  if (!text || text.length === 0) return 0;

  const charFreq = new Map<string, number>();
  const normalized = text.toLowerCase().replace(/\s+/g, '');

  for (const char of normalized) {
    charFreq.set(char, (charFreq.get(char) || 0) + 1);
  }

  let entropy = 0;
  const length = normalized.length;

  for (const count of charFreq.values()) {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
};

/**
 * Check if text extraction resulted in very little or poor quality content
 * Indicates a scanned/image-based document or unreadable encoded text.
 */
const isLowQualityExtraction = (text: string): boolean => {
  const cleaned = text.trim();

  // Completely empty or very short
  if (cleaned.length < 50) return true;

  // Check for garbled text patterns (short words)
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 10) return true; // Too few words extracted

  const shortWords = words.filter(w => w.length <= 2).length;
  const shortWordRatio = shortWords / Math.max(words.length, 1);

  // Lowered threshold from 70% to 50%
  if (shortWordRatio > 0.5) return true;

  // Check character diversity (entropy)
  // Typical English text has entropy ~4.0-4.5
  // Garbled text like "I I I I" has low entropy ~1.0-2.0
  const entropy = calculateEntropy(cleaned);
  if (entropy < 2.5) return true;

  // Check for repetitive character patterns
  const charCounts = new Map<string, number>();
  for (const char of cleaned.toLowerCase().replace(/\s/g, '')) {
    charCounts.set(char, (charCounts.get(char) || 0) + 1);
  }

  // If any single character appears >40% of the time, likely garbled
  const maxCharFreq = Math.max(...charCounts.values());
  const repetitionRatio = maxCharFreq / cleaned.replace(/\s/g, '').length;
  if (repetitionRatio > 0.4) return true;

  // Check for resume-specific keywords
  const lowerText = cleaned.toLowerCase();
  const keywordMatches = RESUME_INDICATORS.filter(keyword =>
    lowerText.includes(keyword)
  ).length;

  // If no resume keywords found in substantial text, likely garbage
  if (cleaned.length > 200 && keywordMatches === 0) return true;
  if (cleaned.length > 100 && keywordMatches < 2) return true;

  return false;
};

/**
 * Calculate extraction quality score (0-1)
 * Used to warn users about poor text extraction results.
 */
const calculateExtractionQuality = (text: string): number => {
  if (!text || text.trim().length === 0) return 0;

  const cleaned = text.trim();
  let score = 1.0;

  // Penalize short extractions
  if (cleaned.length < 100) score *= 0.3;
  else if (cleaned.length < 200) score *= 0.6;
  else if (cleaned.length < 500) score *= 0.8;

  // Check word count and quality
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 20) score *= 0.4;
  else if (words.length < 50) score *= 0.7;

  // Penalize high ratio of short words
  const shortWords = words.filter(w => w.length <= 2).length;
  const shortWordRatio = shortWords / Math.max(words.length, 1);
  if (shortWordRatio > 0.5) score *= 0.3;
  else if (shortWordRatio > 0.3) score *= 0.6;

  // Check entropy
  const entropy = calculateEntropy(cleaned);
  if (entropy < 2.0) score *= 0.2;
  else if (entropy < 3.0) score *= 0.5;
  else if (entropy < 3.5) score *= 0.8;

  // Check for resume keywords
  const lowerText = cleaned.toLowerCase();
  const keywordMatches = RESUME_INDICATORS.filter(keyword =>
    lowerText.includes(keyword)
  ).length;

  const keywordScore = Math.min(keywordMatches / 5, 1.0);
  score *= (0.6 + 0.4 * keywordScore); // Keyword presence is weighted at 40%

  return Math.max(0, Math.min(1, score));
};

type ExtractionResult = {
  text: string;
  usedOCR: boolean;
  quality: number;
  warnings: string[];
};

const extractText = async (
  body: ParseResumeRequest
): Promise<ExtractionResult> => {
  if (body.kind === "text") {
    const text = typeof body.value === "string" ? body.value : "";
    const quality = calculateExtractionQuality(text);
    return {
      text,
      usedOCR: false,
      quality,
      warnings: quality < 0.5 ? ["Text quality is low. Ensure you've pasted the complete resume content."] : []
    };
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

    // Check if it's an image file
    const isImage = IMAGE_MIME_TYPES.has(mimeType);

    if (!isImage && !SUPPORTED_FILE_MIME_TYPES.has(mimeType)) {
      throw new Error("Unsupported file type.");
    }

    if (isImage) {
      throw new UnreadableResumeError("Scanned or image-only resumes are not currently supported. Please upload a text-based PDF/DOCX/TXT file or paste your resume text directly.");
    }

    // Try standard text extraction first for PDFs/DOCX
    const extractedText = await extractPlainTextFromArrayBuffer(arrayBuffer, {
      mimeType,
      fileName: body.name,
    });

    if (isLowQualityExtraction(extractedText)) {
      throw new UnreadableResumeError();
    }

    const quality = calculateExtractionQuality(extractedText);
    return {
      text: extractedText,
      usedOCR: false,
      quality,
      warnings: quality < 0.6 ? ["Text extraction quality is low. Consider uploading a text-based PDF or pasting content directly."] : []
    };
  }

  throw new Error("Invalid parse request.");
};

const baseHandler: Handler = async (event) => {
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
    const rawBody = event.body ? JSON.parse(event.body) : {};

    // Handle direct text input or normalize to ParseResumeRequest format
    let body: ParseResumeRequest;
    if (typeof rawBody.text === "string") {
      // Direct text payload from Postman
      body = { kind: "text", value: rawBody.text };
    } else if (rawBody.kind === "text" || rawBody.kind === "file") {
      // Already in correct format
      body = rawBody as ParseResumeRequest;
    } else if (typeof rawBody.data === "string" || typeof rawBody.name === "string") {
      // File upload format
      body = {
        kind: "file",
        name: rawBody.name,
        mime: rawBody.mime,
        data: rawBody.data,
      };
    } else {
      // Default to empty text
      body = { kind: "text", value: "" };
    }

    const extractionResult = await extractText(body);

    // Log extraction quality metrics without resume text previews.
    console.log("=========== PARSE RESUME DEBUG ===========");
    console.log("[parse-resume] Extraction method: Standard PDF/DOCX/TXT parsing");
    console.log(`[parse-resume] Raw text length: ${extractionResult.text.length} characters`);
    console.log(`[parse-resume] Extraction quality: ${(extractionResult.quality * 100).toFixed(1)}%`);
    console.log(`[parse-resume] Warnings: ${extractionResult.warnings.length > 0 ? extractionResult.warnings.join('; ') : 'None'}`);

    const normalized = buildResumeDocument(extractionResult.text);

    console.log(`[parse-resume] Normalized plainText length: ${normalized.plainText?.length || 0} characters`);
    console.log(`[parse-resume] Bullets extracted: ${normalized.bullets?.length || 0}`);
    console.log(`[parse-resume] Sections extracted: ${normalized.sections?.length || 0}`);
    console.log("==========================================");

    if (!normalized.plainText || normalized.plainText.trim().length === 0) {
      console.error("[parse-resume] ❌ EXTRACTION FAILED: No text extracted from document");
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
      body: JSON.stringify({
        document: normalized,
        usedOCR: extractionResult.usedOCR,
        quality: extractionResult.quality,
        warnings: extractionResult.warnings,
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to parse resume.";
    if (!(error instanceof UnreadableResumeError)) {
      captureError(error, {
        function: 'parse-resume',
        errorMessage: message,
      });
    }
    const statusCode = error instanceof UnreadableResumeError ? error.statusCode : 400;
    const userMessage = error instanceof UnreadableResumeError
      ? message
      : message.includes("Unsupported")
      ? "Unsupported file type. Please upload a PDF, DOCX, or TXT file, or paste your resume text directly."
      : message.includes("exceeds")
        ? "File is too large. Please use a file smaller than 8 MB."
        : `Unable to parse resume: ${message}`;

    return {
      statusCode,
      headers: HEADERS,
      body: JSON.stringify({ error: userMessage }),
    };
  }
};

// Export handler with rate limiting applied
const handler = withRateLimit("parse-resume", baseHandler);
export { handler };
