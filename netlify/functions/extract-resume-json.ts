import { parseResumeOnly } from "../lib/gemini-client.js";
import { extractPlainTextFromArrayBuffer, inferMimeType } from "../lib/resumeText.js";
import { withRateLimit } from "../lib/rate-limiter.js";
import { getSupabaseClient } from "../lib/supabase-client.js";
import { initSentry, captureError, summarizeErrorForLog } from "../lib/sentry.js";

initSentry();

const MIN_READABLE_TEXT_LENGTH = 100;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_CHARS = 50_000;

const UNREADABLE_FILE_RESPONSE = {
  statusCode: 422,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    error: "Could not extract readable text from the uploaded file. Please upload a text-based PDF/DOCX/TXT file or paste your resume text directly.",
    details: "The uploaded file did not contain enough selectable text. Scanned or image-only resumes are not currently supported by this parser."
  }),
};

const baseHandler = async (event: { httpMethod: string; body: string; headers: any; }) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Authentication required. Please sign in." }),
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server configuration error. Please contact support." }),
    };
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid or expired authentication token" }),
    };
  }

  // Check for API key before proceeding
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("[extract-resume-json] OPENROUTER_API_KEY is not set");
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server configuration error: AI service not configured" }),
    };
  }

  try {
    console.log(`[extract-resume-json] Received request. Method: ${event.httpMethod}`);
    const body = JSON.parse(event.body);
    const { data, kind, name, mime } = body;
    console.log(`[extract-resume-json] Payload kind: ${kind}, Data length: ${data ? data.length : 'N/A'}`);

    let analysis;
    let extractedPlainText = "";

    // Mirrors the frontend check in api.js: reject CID-font / scanned-PDF binary garbage.
    // CID fonts missing a ToUnicode CMap produce raw glyph indices that land in the
    // Latin-1 Supplement block (ö, ü, ã, ÿ…) — real Unicode letters — so both a
    // printable-char ratio and a \p{L} ratio check are defeated (observed ratio: 50–72%).
    //
    // Word-level analysis discriminates correctly: real resume text (English/Arabic)
    // has ≥5 whitespace-delimited pure-letter tokens; CID garbage has almost none
    // because its "letters" are isolated between symbol fragments.
    const isReadableText = (text: string): boolean => {
      const sample = text.substring(0, 500);
      const words = sample
        .split(/[\s,;:.!?(){}\[\]|/\\]+/) // eslint-disable-line no-useless-escape
        .filter(w => /^[\p{L}]{2,}$/u.test(w));
      return words.length >= 5 && words.length / sample.length > 0.02;
    };

    if (kind === "file" && data) {
      // CRITICAL FIX: Extract text from PDF/DOCX BEFORE sending to Gemini
      // This ensures we always have the full text regardless of Gemini's response
      try {
        const buffer = Buffer.from(data, "base64");
        if (buffer.byteLength > MAX_FILE_BYTES) {
          return {
            statusCode: 413,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Uploaded file is too large. Please upload a smaller resume file." }),
          };
        }

        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        const mimeType = inferMimeType({ mimeType: mime, fileName: name });
        const rawExtracted = await extractPlainTextFromArrayBuffer(arrayBuffer, { mimeType, fileName: name });
        console.log(`[extract-resume-json] Pre-extracted text length: ${rawExtracted.length} chars`);

        if (rawExtracted.length >= MIN_READABLE_TEXT_LENGTH && isReadableText(rawExtracted)) {
          extractedPlainText = rawExtracted;
          console.log(`[extract-resume-json] Pre-extracted readable text length: ${extractedPlainText.length} chars`);
        } else if (rawExtracted.length > 0) {
          console.warn("[extract-resume-json] Pre-extracted text was too short or failed readability check — treating as unreadable.");
        }
      } catch (extractError) {
        console.warn("[extract-resume-json] Pre-extraction failed:", summarizeErrorForLog(extractError));
      }

      if (extractedPlainText.length < MIN_READABLE_TEXT_LENGTH) {
        console.warn("[extract-resume-json] File payload did not contain enough readable selectable text.");
        return UNREADABLE_FILE_RESPONSE;
      }

      console.log("[extract-resume-json] Using pre-extracted text for parsing...");
      analysis = await parseResumeOnly(extractedPlainText, false);
      console.log("[extract-resume-json] parseResumeOnly returned success.");
    } else if (kind === "text" && body.value) {
      if (typeof body.value !== "string" || body.value.length > MAX_TEXT_CHARS) {
        return {
          statusCode: 413,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Resume text is too large. Please shorten it and try again." }),
        };
      }

      // Defense-in-depth: reject garbage even if it slipped past the client-side check.
      // This catches cases where the client had a stale bundle or a bug in isReadableText.
      if (!isReadableText(body.value)) {
        console.warn("[extract-resume-json] ⚠️ Text payload failed server-side readability check — CID-font garbage suspected.");
        return {
          statusCode: 422,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error: "Could not read the uploaded file. It may use an unsupported font encoding. Please try a different PDF or paste your resume text directly.",
            details: "Text payload failed readability check (CID-font garbage suspected)."
          }),
        };
      }
      console.log("[extract-resume-json] Calling parseResumeOnly with text...");
      extractedPlainText = body.value;
      analysis = await parseResumeOnly(body.value, false);
    } else {
      console.warn("[extract-resume-json] Invalid input keys:", Object.keys(body || {}));
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid input" }) };
    }


    // CRITICAL FIX: Safely extract string from potentially object values
    // This prevents [object Object] being used as plainText (15 chars bug)
    const safeStringify = (value: unknown): string => {
      if (typeof value === 'string') return value;
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') {
        // Try to extract text from object if it has a text-like property
        const obj = value as Record<string, unknown>;
        if (typeof obj.text === 'string') return obj.text;
        if (typeof obj.plainText === 'string') return obj.plainText;
        if (typeof obj.raw_text === 'string') return obj.raw_text;
        if (typeof obj.content === 'string') return obj.content;
        console.warn('[extract-resume-json] ⚠️ Received object instead of string for plainText:', {
          keys: Object.keys(obj).slice(0, 20),
        });
        return ''; // Don't coerce object to "[object Object]"
      }
      return String(value); // For primitives like number, boolean
    };


    // DEBUG: Log shape only. Do not log resume text or AI raw text.
    console.log('[extract-resume-json] DEBUG: typeof analysis.plainText:', typeof analysis.plainText);
    console.log('[extract-resume-json] DEBUG: typeof analysis.meta?.raw_text:', typeof analysis.meta?.raw_text);

    // Use the best available plain text source:
    // 1. Pre-extracted text from PDF (most reliable)
    // 2. Gemini's plainText field
    // 3. Gemini's meta.raw_text field
    const geminiPlainText = safeStringify(analysis.plainText) || safeStringify(analysis.meta?.raw_text) || "";
    console.log('[extract-resume-json] DEBUG: geminiPlainText length after safeStringify:', geminiPlainText.length);


    // CRITICAL: Detect Gemini placeholder responses that indicate it couldn't read the PDF
    // These placeholders mean Gemini didn't receive valid PDF content
    const PLACEHOLDER_PATTERNS = [
      "please provide",
      "i cannot",
      "i'm unable",
      "no resume",
      "no content",
      "cannot extract",
      "unable to extract",
      "provide the resume",
    ];
    const geminiTextLower = geminiPlainText.toLowerCase();
    const isGeminiPlaceholder = PLACEHOLDER_PATTERNS.some(pattern => geminiTextLower.includes(pattern));

    if (isGeminiPlaceholder) {
      console.warn('[extract-resume-json] ⚠️ Gemini returned placeholder response', {
        length: geminiPlainText.length,
      });
    }

    // Choose the best available text, excluding Gemini placeholders
    let bestPlainText: string;
    let textSource: string;

    if (extractedPlainText.length > 200) {
      // Pre-extracted text is substantial, use it
      bestPlainText = extractedPlainText;
      textSource = "pre-extracted";
    } else if (!isGeminiPlaceholder && geminiPlainText.length > 200) {
      // Gemini returned valid content (not a placeholder)
      bestPlainText = geminiPlainText;
      textSource = "gemini";
    } else if (extractedPlainText.length > 0) {
      // Fall back to whatever pre-extraction got
      bestPlainText = extractedPlainText;
      textSource = "pre-extracted-fallback";
    } else if (!isGeminiPlaceholder && geminiPlainText.length > 0) {
      // Use Gemini as last resort if not placeholder
      bestPlainText = geminiPlainText;
      textSource = "gemini-fallback";
    } else {
      // Both methods failed - return error
      console.error("[extract-resume-json] ❌ Both PDF extraction methods failed");
      console.error(`[extract-resume-json] Pre-extracted: ${extractedPlainText.length} chars`);
      console.error(`[extract-resume-json] Gemini: ${geminiPlainText.length} chars (placeholder: ${isGeminiPlaceholder})`);
      return {
        statusCode: 422,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Could not extract text from the uploaded file. Please try a different PDF or paste your resume text directly.",
          details: "Both PDF parsing and AI extraction failed to extract meaningful content."
        }),
      };
    }

    console.log(`[extract-resume-json] Final plainText length: ${bestPlainText.length} chars`);
    console.log(`[extract-resume-json] Source: ${textSource}`);

    // Preserve the FULL JSON Resume structure from Gemini parsing
    // The analysis object already contains: basics, work, education, skills, projects, certificates, etc.
    const document = {
      // Plain text for backward compatibility - USE THE BEST AVAILABLE SOURCE
      plainText: bestPlainText,

      // Full JSON Resume fields - these are properly parsed by Gemini
      basics: analysis.basics || {},
      work: analysis.work || [],
      education: analysis.education || [],
      skills: analysis.skills || [],
      projects: analysis.projects || [],
      certificates: analysis.certificates || [],
      languages: analysis.languages || [],

      // Legacy structured sections (backward compatibility)
      sections: [
        { title: "Contact", content: [`Name: ${analysis.basics?.name || ""}`, `Email: ${analysis.basics?.email || ""}`, `Phone: ${analysis.basics?.phone || ""}`] },
        { title: "Summary", content: [analysis.basics?.summary || ""] },
        { title: "Skills", content: Array.isArray(analysis.skills) ? analysis.skills.flatMap(s => typeof s === 'string' ? s : (s.keywords || [])) : [] },
        { title: "Experience", content: (analysis.work || []).map(exp => `${exp.position || ""} at ${exp.name || ""} (${exp.startDate || ""} - ${exp.endDate || ""})`) },
        { title: "Education", content: (analysis.education || []).map(edu => `${edu.studyType || ""} ${edu.area || ""} from ${edu.institution || ""} (${edu.endDate || ""})`) },
        { title: "Projects", content: (analysis.projects || []).map(p => p.name || "") },
        { title: "Certifications", content: (analysis.certificates || []).map(c => c.name || "") }
      ],
      bullets: [],

      // Metadata
      meta: analysis.meta || {}
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document }),
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[extract-resume-json] Parse error:", summarizeErrorForLog(error));

    captureError(error, {
      function: 'extract-resume-json',
      errorMessage,
    });

    // Provide more specific error messages based on the error type
    const isTimeout = (error as any)?.name === 'TimeoutError' || errorMessage.includes("timeout");
    let userMessage = "Failed to parse resume";
    if (errorMessage.includes("API key")) {
      userMessage = "AI service configuration error";
    } else if (errorMessage.includes("quota") || errorMessage.includes("rate limit")) {
      userMessage = "AI service is currently busy. Please try again in a moment.";
    } else if (errorMessage.includes("JSON") || errorMessage.includes("parse")) {
      userMessage = "Failed to parse AI response. Please try again.";
    } else if (isTimeout) {
      userMessage = "Parsing timed out. Retrying automatically...";
    } else if (errorMessage.includes("network")) {
      userMessage = "Network error. Please check your connection and try again.";
    }

    return {
      statusCode: isTimeout ? 504 : 500,
      headers: {
        "Content-Type": "application/json",
        ...(isTimeout && {
          'Retry-After': '30',
          'X-Timeout-Location': 'openrouter-api'
        })
      },
      body: JSON.stringify({
        error: userMessage,
        retryable: isTimeout,
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined
      }),
    };
  }
};

// Export handler with rate limiting applied
export const handler = withRateLimit("extract-resume-json", baseHandler);
