import { parseResumeOnly } from "../lib/gemini-client.js";
import { buildDeterministicBaseline, detectSectionSignals, findMissingSections, recoverSectionsFromRawText } from "../lib/parse-quality.js";
import { extractPlainTextFromArrayBuffer, inferMimeType, normalizeResumeText } from "../lib/resumeText.js";
import { extractScannedPdfText } from "../lib/ocr-extract.js";
import { withRateLimit, checkGuestPreviewRateLimit } from "../lib/rate-limiter.js";
import { getSupabaseClient } from "../lib/supabase-client.js";
import { initSentry, captureError, summarizeErrorForLog } from "../lib/sentry.js";

initSentry();

const MIN_READABLE_TEXT_LENGTH = 100;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_CHARS = 50_000;
const GUEST_MAX_FILE_BYTES = 2 * 1024 * 1024;
const GUEST_MAX_TEXT_CHARS = 20_000;
const OCR_MAX_TIMEOUT_MS = 12_000;
const OCR_PARSE_MAX_TIMEOUT_MS = 12_000;
const PARSE_MAX_TIMEOUT_MS = 20_000; // mirrors the parse_resume contract timeoutMs
const FUNCTION_SAFETY_MS = 2_500;
const OCR_PARSE_RESERVE_MS = OCR_PARSE_MAX_TIMEOUT_MS + FUNCTION_SAFETY_MS;

// Netlify's HTTP gateway cuts synchronous function responses at ~30s in
// production REGARDLESS of the (70s) Lambda timeout configured in netlify.toml.
// getRemainingTimeInMillis() reports the Lambda budget, so trusting it alone
// let pre-extraction + OCR (12s) + AI parse (12-20s) overrun the gateway →
// the client saw a raw 502/504 ("AI service is experiencing high load") even
// though the provider was healthy. Every AI budget below is therefore clamped
// to the time remaining in this gateway window, measured from request start.
const GATEWAY_WALL_CLOCK_MS = 26_000;

const computeRemainingBudgetMs = (
  context: ParseHandlerContext | undefined,
  startedAt: number,
): number => {
  const lambdaRemainingMs = context?.getRemainingTimeInMillis?.() ?? Number.POSITIVE_INFINITY;
  const gatewayRemainingMs = GATEWAY_WALL_CLOCK_MS - (Date.now() - startedAt);
  return Math.max(0, Math.min(lambdaRemainingMs, gatewayRemainingMs));
};

interface ParseHandlerContext {
  getRemainingTimeInMillis?: () => number;
  requestStartedAt?: number;
}

// Normalize an AI-parse failure into a short, stable code recorded in
// meta.parseQuality.aiFailureCode (never log/store resume text).
const normalizeAiFailureCode = (error: unknown): string => {
  const err = error as { name?: string; code?: string; status?: number } | undefined;
  return err?.code || err?.name || (err?.status ? `HTTP_${err.status}` : "unknown");
};

const UNREADABLE_FILE_RESPONSE = {
  statusCode: 422,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    error: "Could not extract readable text from the uploaded file. Please upload a text-based PDF/DOCX/TXT file or paste your resume text directly.",
    code: "resume/unreadable-file",
    details: "The uploaded file did not contain enough selectable text. Scanned or image-only resumes are not currently supported by this parser."
  }),
};

const baseHandler = async (
  event: { httpMethod: string; body: string; headers: any; },
  context?: ParseHandlerContext,
) => {
  const startedAt = context?.requestStartedAt ?? Date.now();
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body: any;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }

  const guestPreview = body?.guestPreview === true;
  const authHeader = event.headers?.authorization || event.headers?.Authorization;

  if (!authHeader && !guestPreview) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Authentication required. Please sign in." }),
    };
  }

  if (authHeader) {
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
  } else {
    // Unauthenticated guest preview — stricter rate limit, no Supabase access.
    const guestRateLimit = await checkGuestPreviewRateLimit(event as any);
    if (!guestRateLimit.allowed) {
      return guestRateLimit.response!;
    }
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
    const { data, kind, name, mime } = body;
    console.log(`[extract-resume-json] Payload kind: ${kind}, Data length: ${data ? data.length : 'N/A'}`);

    let analysis;
    let extractedPlainText = "";
    let previewTruncated = false;
    let ocrMeta: { ocrFallback: true; pagesProcessed: number } | null = null;
    let ocrAttempted = false;
    let aiParseFailed = false;
    let aiFailureCode: string | undefined;

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
        if (guestPreview && buffer.byteLength > GUEST_MAX_FILE_BYTES) {
          return {
            statusCode: 413,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              error: "Preview files are limited to 2MB. Please sign in to process larger files.",
              code: "guest/file-too-large",
            }),
          };
        }
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

      // Scanned / image-only PDF: no selectable text layer to read. Signed-in
      // users get an OCR fallback that transcribes EVERY page via the vision
      // model; guests keep the existing rejection (no anonymous OCR/vision cost).
      if (extractedPlainText.length < MIN_READABLE_TEXT_LENGTH) {
        const isPdf = inferMimeType({ mimeType: mime, fileName: name }) === "application/pdf";
        if (!guestPreview && isPdf && process.env.OPENROUTER_API_KEY) {
          try {
            console.log("[extract-resume-json] No selectable text found; attempting OCR fallback.");
            ocrAttempted = true;
            const remainingMs = computeRemainingBudgetMs(context, startedAt);
            const ocrTimeoutMs = Math.min(
              OCR_MAX_TIMEOUT_MS,
              Math.max(1_000, remainingMs - OCR_PARSE_RESERVE_MS),
            );
            const ocr = await extractScannedPdfText(
              { base64Data: data, mime, fileName: name },
              { timeoutMs: ocrTimeoutMs },
            );
            if (ocr.text.length >= MIN_READABLE_TEXT_LENGTH && isReadableText(ocr.text)) {
              extractedPlainText = ocr.text;
              ocrMeta = { ocrFallback: true, pagesProcessed: ocr.pagesProcessed };
              console.log(`[extract-resume-json] OCR produced ${extractedPlainText.length} chars across ${ocr.pagesProcessed} page(s).`);
            } else {
              console.warn(`[extract-resume-json] OCR fallback produced insufficient text (${ocr.text.length} chars).`);
            }
          } catch (ocrError) {
            console.warn("[extract-resume-json] OCR fallback failed:", summarizeErrorForLog(ocrError));
          }
        }

        if (extractedPlainText.length < MIN_READABLE_TEXT_LENGTH) {
          console.warn("[extract-resume-json] File payload did not contain enough readable selectable text.");
          // When OCR ran but couldn't finish (timeout/budget) or came back empty,
          // "scanned resumes are not supported" would be wrong — tell the user
          // what actually happened and how to succeed instead.
          if (ocrAttempted) {
            return {
              statusCode: 422,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                error: "We couldn't finish reading this scanned file. Please try again, upload a smaller or text-based PDF, or paste your resume text directly.",
                code: "resume/unreadable-file",
                details: "OCR fallback was attempted but did not produce enough readable text within the time budget.",
              }),
            };
          }
          return UNREADABLE_FILE_RESPONSE;
        }
      }

      // Guest preview extracted-text cap. The text branch already rejects >20k, but a
      // <=2MB text-based PDF can extract beyond the guest cap. Truncate for the preview
      // and flag it explicitly (no silent loss → no misleading missing-section warnings).
      if (guestPreview && extractedPlainText.length > GUEST_MAX_TEXT_CHARS) {
        console.warn(`[extract-resume-json] Guest preview extracted text ${extractedPlainText.length} chars exceeds ${GUEST_MAX_TEXT_CHARS}; truncating for preview.`);
        extractedPlainText = extractedPlainText.slice(0, GUEST_MAX_TEXT_CHARS);
        previewTruncated = true;
      }
    } else if (kind === "text" && body.value) {
      if (typeof body.value !== "string" || body.value.length > MAX_TEXT_CHARS) {
        return {
          statusCode: 413,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Resume text is too large. Please shorten it and try again." }),
        };
      }

      if (
        guestPreview
        && body.sourceFileSizeBytes !== undefined
        && Number.isFinite(Number(body.sourceFileSizeBytes))
        && Number(body.sourceFileSizeBytes) > GUEST_MAX_FILE_BYTES
      ) {
        return {
          statusCode: 413,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error: "Preview files are limited to 2MB. Please sign in to process larger files.",
            code: "guest/file-too-large",
          }),
        };
      }

      if (guestPreview && body.value.length > GUEST_MAX_TEXT_CHARS) {
        return {
          statusCode: 413,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error: "Preview text is limited to 20,000 characters. Please sign in to process longer resumes.",
            code: "guest/text-too-large",
          }),
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
            code: "resume/unreadable-file",
            details: "Text payload failed readability check (CID-font garbage suspected)."
          }),
        };
      }
      extractedPlainText = body.value;
    } else {
      console.warn("[extract-resume-json] Invalid input keys:", Object.keys(body || {}));
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid input" }) };
    }

    // Canonical raw text + section signals — computed BEFORE the AI call so the
    // deterministic baseline is available even when the AI parser fails.
    const rawForSignals = normalizeResumeText(extractedPlainText || "");
    const signals = detectSectionSignals(rawForSignals);

    // ---- AI structured parse (the ONLY part allowed to fall back) ----------
    // Readable text already exists here, so an AI parser/fallback failure must
    // NEVER 500: we build the deterministic skeleton from the raw text and let
    // the recovery pass below enrich it. Non-AI bugs (recovery, assembly) are
    // intentionally OUTSIDE this try so they surface normally.
    try {
      console.log("[extract-resume-json] Parsing extracted text...");
      // Clamp the parse timeout to the gateway budget on EVERY path (not just
      // after OCR): slow pre-extraction + the contract's 20s default could
      // otherwise overrun the gateway. A too-small budget just means the parse
      // times out fast and the deterministic baseline below still returns 200.
      const parseTimeoutMs = Math.min(
        ocrMeta ? OCR_PARSE_MAX_TIMEOUT_MS : PARSE_MAX_TIMEOUT_MS,
        Math.max(1_000, computeRemainingBudgetMs(context, startedAt) - FUNCTION_SAFETY_MS),
      );
      analysis = await parseResumeOnly(extractedPlainText, false, { timeoutMs: parseTimeoutMs });
      console.log("[extract-resume-json] parseResumeOnly returned success.");
    } catch (parseError) {
      aiParseFailed = true;
      aiFailureCode = normalizeAiFailureCode(parseError);
      console.warn(`[extract-resume-json] AI parse failed (${aiFailureCode}); building deterministic baseline from raw text:`, summarizeErrorForLog(parseError));
      analysis = buildDeterministicBaseline(rawForSignals, signals);
    }

    // ---- Parse-quality gate + deterministic, evidence-only recovery --------
    // Compare raw-text section signals against the structured output and recover
    // anything the parser dropped DIRECTLY from the raw text (no AI retry, no
    // fabrication). Recovery always runs: it is cheap, fills only gaps, and is
    // the path that also enriches dropped work entries.
    const recovery = recoverSectionsFromRawText(analysis, signals, rawForSignals);
    analysis = recovery.analysis;
    let fallbackSections: string[] = recovery.fallbackSections;
    let incompleteSections = findMissingSections(signals, analysis);

    // On AI failure every populated section came from deterministic recovery, so
    // report them all as fallbackSections (recovery only reports the gaps it
    // filled relative to its own baseline input).
    if (aiParseFailed) {
      const determ = new Set<string>(fallbackSections);
      for (const s of ["education", "certificates", "projects", "skills", "languages"]) {
        if (Array.isArray(analysis[s]) && analysis[s].length > 0) determ.add(s);
      }
      if (Array.isArray(analysis.work) && analysis.work.length > 0) determ.add("experience");
      if (analysis.basics?.email) determ.add("email");
      if (analysis.basics?.phone) determ.add("phone");
      fallbackSections = [...determ];
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
          code: "resume/unreadable-file",
          details: "Both PDF parsing and AI extraction failed to extract meaningful content."
        }),
      };
    }

    console.log(`[extract-resume-json] Final plainText length: ${bestPlainText.length} chars`);
    console.log(`[extract-resume-json] Source: ${textSource}`);

    // Parse-quality metadata: lets the frontend suppress misleading "No X found"
    // warnings when the section was lost in parsing or cut by the guest preview cap.
    const parseQuality: { incompleteSections?: string[]; previewTruncated?: boolean; fallbackSections?: string[]; extractionSource?: string; ocrFallback?: boolean; pagesProcessed?: number; aiParseFailed?: boolean; aiFailureCode?: string; confidence?: string } = {};
    if (incompleteSections.length > 0) parseQuality.incompleteSections = incompleteSections;
    if (previewTruncated) parseQuality.previewTruncated = true;
    if (fallbackSections.length > 0) parseQuality.fallbackSections = fallbackSections;

    // How the final structured sections were sourced:
    //   base    = the actual text source: OCR, server-side file extraction,
    //             client-side file extraction, or direct/pasted text.
    //   suffix  = "+deterministic" when the AI parser failed and the whole
    //             skeleton was built from raw text; "+recovery" when the AI
    //             parse succeeded but deterministic recovery filled dropped
    //             sections; "" when the AI parse needed no recovery.
    const extractionBase = ocrMeta
      ? "ocr"
      : kind === "file"
        ? "server"
        : body.sourceWasFile === true
          ? "client"
          : "text";
    const extractionSuffix = aiParseFailed ? "+deterministic" : (fallbackSections.length > 0 ? "+recovery" : "");
    parseQuality.extractionSource = `${extractionBase}${extractionSuffix}`;
    if (ocrMeta) {
      parseQuality.ocrFallback = true;
      parseQuality.pagesProcessed = ocrMeta.pagesProcessed;
    }
    if (aiParseFailed) {
      parseQuality.aiParseFailed = true;
      parseQuality.aiFailureCode = aiFailureCode;
      parseQuality.confidence = "low";
    }

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
      meta: {
        ...(analysis.meta || {}),
        ...(Object.keys(parseQuality).length > 0 ? { parseQuality } : {}),
      }
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

const rateLimitedHandler = withRateLimit("extract-resume-json", baseHandler);

// Capture the HTTP request start before rate limiting. Upstash is allowed to
// consume up to 3s, and that time belongs to the same ~30s gateway window as
// extraction, OCR, and parsing.
export const handler: typeof rateLimitedHandler = (event, context) => {
  (context as ParseHandlerContext).requestStartedAt = Date.now();
  return rateLimitedHandler(event, context);
};
