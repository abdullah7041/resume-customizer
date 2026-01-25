import { parseResumeOnly } from "../lib/gemini-client";
import { extractPlainTextFromArrayBuffer, inferMimeType } from "../lib/resumeText.js";
import { withRateLimit } from "../lib/rate-limiter";
import { initSentry, captureError } from "../lib/sentry";

initSentry();

const baseHandler = async (event: { httpMethod: string; body: string; headers: any; }) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
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

    if (kind === "file" && data) {
      // CRITICAL FIX: Extract text from PDF/DOCX BEFORE sending to Gemini
      // This ensures we always have the full text regardless of Gemini's response
      try {
        const buffer = Buffer.from(data, "base64");
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        const mimeType = inferMimeType({ mimeType: mime, fileName: name });
        extractedPlainText = await extractPlainTextFromArrayBuffer(arrayBuffer, { mimeType, fileName: name });
        console.log(`[extract-resume-json] Pre-extracted text length: ${extractedPlainText.length} chars`);
        if (extractedPlainText.length > 0) {
          console.log(`[extract-resume-json] Pre-extracted preview: "${extractedPlainText.slice(0, 300).replace(/\s+/g, ' ')}"`);
        }
      } catch (extractError) {
        console.warn("[extract-resume-json] Pre-extraction failed, will rely on Gemini:", extractError);
      }

      // OPTIMIZATION: Use pre-extracted text if available (much faster than PDF parsing)
      // PDF mode takes 30-45s, text mode takes ~5-10s
      if (extractedPlainText.length > 200) {
        console.log("[extract-resume-json] Using pre-extracted text for faster parsing...");
        analysis = await parseResumeOnly(extractedPlainText, false);
      } else {
        console.log("[extract-resume-json] Calling parseResumeOnly with PDF data (fallback)...");
        analysis = await parseResumeOnly(data, true);
      }
      console.log("[extract-resume-json] parseResumeOnly returned success.");
    } else if (kind === "text" && body.value) {
      console.log("[extract-resume-json] Calling parseResumeOnly with text...");
      extractedPlainText = body.value;
      analysis = await parseResumeOnly(body.value, false);
    } else {
      console.warn("[extract-resume-json] Invalid input:", body);
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
        // Log warning for debugging
        console.warn('[extract-resume-json] ⚠️ Received object instead of string for plainText:', JSON.stringify(value).substring(0, 200));
        return ''; // Don't coerce object to "[object Object]"
      }
      return String(value); // For primitives like number, boolean
    };


    // DEBUG: Log what analysis contains
    console.log('[extract-resume-json] DEBUG: typeof analysis.plainText:', typeof analysis.plainText);
    console.log('[extract-resume-json] DEBUG: analysis.plainText preview:',
      typeof analysis.plainText === 'string' ? analysis.plainText.substring(0, 100) : JSON.stringify(analysis.plainText)?.substring(0, 200));
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
      console.warn(`[extract-resume-json] ⚠️ Gemini returned placeholder response: "${geminiPlainText.slice(0, 100)}"`);
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
    console.error("[extract-resume-json] Parse error:", errorMessage, error);

    captureError(error, {
      function: 'extract-resume-json',
      errorMessage,
    });

    // Provide more specific error messages based on the error type
    let userMessage = "Failed to parse resume";
    if (errorMessage.includes("API key")) {
      userMessage = "AI service configuration error";
    } else if (errorMessage.includes("quota") || errorMessage.includes("rate limit")) {
      userMessage = "AI service is currently busy. Please try again in a moment.";
    } else if (errorMessage.includes("JSON") || errorMessage.includes("parse")) {
      userMessage = "Failed to parse AI response. Please try again.";
    } else if (errorMessage.includes("timeout") || errorMessage.includes("network")) {
      userMessage = "Network error. Please check your connection and try again.";
    }

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: userMessage,
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined
      }),
    };
  }
};

// Export handler with rate limiting applied
export const handler = withRateLimit("extract-resume-json", baseHandler);
