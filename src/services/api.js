// src/services/api.js
import { supabase } from './supabase';
import * as Sentry from '@sentry/react';
import { isCircuitOpen, recordFailure, recordSuccess } from '../lib/utils/circuit-breaker';
import { extractPlainTextFromArrayBuffer, inferMimeType } from '../lib/utils/resumeText';

const FUNCTION_BASE_PATH = "/.netlify/functions";
const MATCH_ENDPOINT = `${FUNCTION_BASE_PATH}/ai-match`;
const PARSE_ENDPOINT = `${FUNCTION_BASE_PATH}/extract-resume-json`;
const OPTIMIZE_ENDPOINT = `${FUNCTION_BASE_PATH}/optimize`;
const REFINE_BULLET_ENDPOINT = `${FUNCTION_BASE_PATH}/refine-bullet`;
const OPTIMIZE_STREAM_ENDPOINT = `/api/optimize-stream`;
const CLARIFY_ENDPOINT = `${FUNCTION_BASE_PATH}/generate-clarifications`;
const VISION2030_ENDPOINT = `${FUNCTION_BASE_PATH}/vision2030-alignment`;
const TRUTH_CHECK_ENDPOINT = `${FUNCTION_BASE_PATH}/resume-truth-check`;
export const AI_DEFAULT_TEMPERATURE = 0.4;
export const AUTH_REQUIRED = 'AUTH_REQUIRED';
export const AUTH_REQUIRED_RESUME_MESSAGE = 'Please sign in to securely process your resume.';
const GUEST_MAX_FILE_BYTES = 2 * 1024 * 1024;
const GUEST_FILE_TOO_LARGE_MESSAGE = 'Preview files are limited to 2MB. Please sign in to process larger files.';

export const createAuthRequiredError = (message = AUTH_REQUIRED_RESUME_MESSAGE) => {
  const error = new Error(message);
  error.status = 401;
  error.type = AUTH_REQUIRED;
  error.code = 'auth/required';
  return error;
};

export const isAuthRequiredError = (error) =>
  error?.type === AUTH_REQUIRED || error?.code === 'auth/required' || error?.status === 401;

const summarizeErrorForConsole = (error) => ({
  name: error?.name || 'Error',
  message: error?.message || 'Unknown error',
  status: error?.status || null,
  type: error?.type || null,
});

const REALITY_CHECK_FALLBACK = {
  riskTier: 'medium',
  recommendation: 'answer_clarifications_first',
  confidence: 'low',
  riskTypes: ['evidence_quality'],
  summary: '',
  strengths: [],
  confirmedRisks: [],
  unclearRisks: [],
  limits: { cannotDetermine: [], assumptions: [] },
};

const normalizeArray = (value) => Array.isArray(value) ? value : [];

const normalizeStrategicRealityCheck = (value) => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const riskTier = ['low', 'medium', 'high', 'critical'].includes(value.riskTier)
    ? value.riskTier
    : REALITY_CHECK_FALLBACK.riskTier;
  const recommendation = [
    'optimize_now',
    'answer_clarifications_first',
    'add_evidence_first',
    'review_role_fit',
  ].includes(value.recommendation)
    ? value.recommendation
    : REALITY_CHECK_FALLBACK.recommendation;
  const confidence = ['low', 'medium', 'high'].includes(value.confidence)
    ? value.confidence
    : REALITY_CHECK_FALLBACK.confidence;

  return {
    ...REALITY_CHECK_FALLBACK,
    ...value,
    riskTier,
    recommendation,
    confidence,
    riskTypes: normalizeArray(value.riskTypes),
    strengths: normalizeArray(value.strengths),
    confirmedRisks: normalizeArray(value.confirmedRisks),
    unclearRisks: normalizeArray(value.unclearRisks),
    limits: {
      cannotDetermine: normalizeArray(value.limits?.cannotDetermine),
      assumptions: normalizeArray(value.limits?.assumptions),
    },
  };
};

const getResponseRequestId = (response) =>
  response.headers?.get?.('x-nf-request-id') ||
  response.headers?.get?.('x-request-id') ||
  response.headers?.get?.('cf-ray') ||
  null;

const attachResponseDebug = (target, response, data = {}) => {
  if (!target || typeof target !== 'object') return target;

  const requestId = data.requestId || data.debug?.requestId || getResponseRequestId(response);
  target.debug = {
    ...(data.debug && typeof data.debug === 'object' ? data.debug : {}),
    ...(requestId ? { requestId } : {}),
  };
  return target;
};

const attachErrorDebug = (error, response, data = {}) => {
  attachResponseDebug(error, response, data);
  error.statusCode = response.status;
  error.errorCode = data.code || error.code || error.type || null;
  error.errorDetail = data.troubleshooting || data.message || data.error || null;
  return error;
};

// Helper to get auth headers
export const getAuthHeaders = async (options = {}) => {
  const { requireAuth = false, authRequiredMessage } = options;
  const headers = { "Content-Type": "application/json" };

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.warn('[API] Failed to retrieve auth session:', summarizeErrorForConsole(sessionError));
    }

    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    } else {
      if (requireAuth) {
        throw createAuthRequiredError(authRequiredMessage);
      }
      console.warn('[API] No active session found - request will be sent without authentication');
    }
  } catch (error) {
    if (isAuthRequiredError(error)) {
      throw error;
    }
    console.error('[API] Unexpected error retrieving auth session:', summarizeErrorForConsole(error));
    if (requireAuth) {
      throw createAuthRequiredError(authRequiredMessage);
    }
    // Don't throw for optional-auth endpoints - allow the endpoint to decide if auth is required.
  }

  return headers;
};

/**
 * Retry helper with exponential backoff and jitter
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Max retry attempts (default: 3)
 * @param {number} baseDelay - Base delay in ms (default: 1000)
 * @returns {Promise} - Result of fn
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on 4xx errors EXCEPT 429 (rate limit)
      // 401, 403, 404, 400 are client errors and should not be retried
      if (error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw error;
      }

      // Don't retry on quota exceeded
      if (error.quotaExceeded) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Log retry reason
      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = baseDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 1000; // 0-1000ms jitter
      const delay = exponentialDelay + jitter;

      // Respect Retry-After header if present
      const retryAfter = error.retryAfter;
      if (retryAfter && typeof retryAfter === 'number') {
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      } else {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted
  throw lastError;
}

// Helper to handle responses
const handleResponse = async (response) => {
  // Parse JSON response body first (needed for error messages)
  const data = await response.json().catch(() => ({}));

  // Handle rate limiting (429 Too Many Requests)
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
    const error = new Error(data.error || `Too many requests. Please wait ${retryAfter} seconds.`);
    error.type = 'RATE_LIMITED';
    error.code = data.code || 'rate/limited';
    error.retryAfter = retryAfter;
    error.status = 429;
    throw attachErrorDebug(error, response, data);
  }

  // Handle authentication errors
  if (response.status === 401) {
    throw attachErrorDebug(createAuthRequiredError(data.error || AUTH_REQUIRED_RESUME_MESSAGE), response, data);
  }

  // Handle Bad Gateway errors (502) - often caused by timeouts
  if (response.status === 502) {
    const error = new Error(data.error || "Service temporarily unavailable. Retrying automatically...");
    error.status = 502;
    error.type = 'BAD_GATEWAY';
    error.retryable = true;
    throw attachErrorDebug(error, response, data);
  }

  // Handle Gateway Timeout errors (504)
  if (response.status === 504) {
    const error = new Error(data.error || "Request timed out. Retrying automatically...");
    error.status = 504;
    error.type = 'GATEWAY_TIMEOUT';
    error.retryable = true;
    throw attachErrorDebug(error, response, data);
  }

  if (!response.ok) {
    // Preserve quota metadata from error response
    const error = new Error(data.error || "Request failed");
    error.status = response.status;
    if (data.code) {
      error.code = data.code;
    }

    if (data.quotaExceeded) {
      error.quotaExceeded = true;
      error.used = data.used;
      error.limit = data.limit;
      error.remaining = data.remaining;
      error.action = data.action;
    }
    throw attachErrorDebug(error, response, data);
  }

  return attachResponseDebug(data, response, data);
};

// Helper to convert file to base64
const fileToBase64 = async (file) => {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const parseResume = async (resumeInput, options = {}) => {
  if (isCircuitOpen('openrouter-ai')) {
    throw new Error('AI service is experiencing high load. Please wait 30 seconds and try again.');
  }
  return retryWithBackoff(async () => {
    try {
      let payload;
      if (resumeInput instanceof File) {
        if (options.guestPreview && resumeInput.size > GUEST_MAX_FILE_BYTES) {
          const error = new Error(GUEST_FILE_TOO_LARGE_MESSAGE);
          error.status = 413;
          error.code = 'file/guest-too-large';
          throw error;
        }

        const sourceFileMetadata = {
          sourceInputKind: 'file',
          sourceWasFile: true,
          sourceFileSizeBytes: resumeInput.size,
        };

        // CLIENT-SIDE TEXT EXTRACTION: Extract text from PDF/DOCX in the browser
        // This saves 5-8s of serverless execution time by avoiding server-side PDF parsing
        let clientExtractedText = '';
        try {
          const arrayBuffer = await resumeInput.arrayBuffer();
          const mimeType = inferMimeType({ mimeType: resumeInput.type, fileName: resumeInput.name });
          clientExtractedText = await extractPlainTextFromArrayBuffer(arrayBuffer, { mimeType, fileName: resumeInput.name });
          console.log(`[API] Client-side extraction: ${clientExtractedText.length} chars from ${resumeInput.name}`);
        } catch (extractError) {
          console.warn('[API] Client-side extraction failed, falling back to server-side:', summarizeErrorForConsole(extractError));
        }

        if (clientExtractedText.length >= 100) {
          // QUALITY CHECK: pdf.js can return binary garbage from CID-font PDFs.
          // CID fonts missing a ToUnicode CMap produce raw glyph indices that land in
          // the Latin-1 Supplement block (ö, ü, ã, ÿ…) — these are real Unicode letters,
          // so both printable-char and \p{L} ratio checks are defeated (ratio 50–72%).
          //
          // Word-level analysis discriminates correctly: real resume text (English/Arabic)
          // has ≥5 whitespace-delimited pure-letter tokens; CID garbage has almost none
          // because its "letters" are isolated between symbol fragments.
          const isReadableText = (text) => {
            const sample = text.substring(0, 500);
            const words = sample
              .split(/[\s,;:.!?(){}\[\]|/\\]+/) // eslint-disable-line no-useless-escape
              .filter(w => /^[\p{L}]{2,}$/u.test(w));
            return words.length >= 5 && words.length / sample.length > 0.02;
          };

          if (isReadableText(clientExtractedText)) {
            // Client extraction succeeded — send plain text (no base64 file transfer)
            console.log('[API] Using client-extracted text (saving server-side PDF parsing time)');
            payload = { kind: "text", value: clientExtractedText, ...sourceFileMetadata };
          } else {
            // Text looks like binary garbage (CID-font PDF, image-based, etc.).
            // Send the file so the server can classify the failure consistently.
            console.warn(`[API] Client extraction returned non-readable text (binary/encoded glyphs). Sending file for server-side validation.`);

            if (typeof options.onOcrFallback === 'function') {
              try { options.onOcrFallback(); } catch { /* never block upload for a UI callback */ }
            }

            const base64 = await fileToBase64(resumeInput);
            payload = {
              kind: "file",
              data: base64,
              name: resumeInput.name,
              mime: resumeInput.type,
              ...sourceFileMetadata,
            };
          }
        } else {
          // Fallback: scanned PDF or extraction failure — send file to server for validation
          console.log('[API] Client extraction insufficient, sending file for server-side validation');

          // Notify the UI that the document may need a text-based re-upload.
          if (typeof options.onOcrFallback === 'function') {
            try { options.onOcrFallback(); } catch { /* never block upload for a UI callback */ }
          }

          const base64 = await fileToBase64(resumeInput);
          payload = {
            kind: "file",
            data: base64,
            name: resumeInput.name,
            mime: resumeInput.type,
            ...sourceFileMetadata,
          };
        }
      } else {
        payload = { kind: "text", value: resumeInput };
      }

      const guestPreview = !!options.guestPreview;
      payload.guestPreview = guestPreview;

      const headers = guestPreview
        ? await getAuthHeaders({ requireAuth: false })
        : await getAuthHeaders({
          requireAuth: true,
          authRequiredMessage: AUTH_REQUIRED_RESUME_MESSAGE,
        });

      const response = await fetch(PARSE_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: options.signal, // Add AbortController signal support
      }).catch(err => {
        // Handle network errors (like Connection Refused)
        if (err.message === "Failed to fetch") {
          const networkError = new Error("Could not connect to the server. Please ensure the Netlify Dev server is running (npm run dev:netlify) and try again.");
          networkError.status = 503;
          throw networkError;
        }
        throw err;
      });

      const data = await handleResponse(response);
      recordSuccess('openrouter-ai');
      return data.document;

    } catch (error) {
      // Handle user-initiated cancellation
      if (error.name === 'AbortError') {
        const cancelError = new Error('Upload cancelled');
        cancelError.cancelled = true;
        throw cancelError;
      }

      // Enrich error with status for retry logic
      error.status = error.status || 500;

      if (isAuthRequiredError(error)) {
        console.warn('[API] Resume parsing requires sign-in:', summarizeErrorForConsole(error));
        throw error;
      }

      if (error.status === 413) {
        console.warn('[API] Resume parsing payload rejected:', summarizeErrorForConsole(error));
        throw error;
      }

      console.error("Parse failed:", summarizeErrorForConsole(error));

      // Capture error in Sentry (even if quota exceeded - helps track usage patterns)
      Sentry.captureException(error, {
        tags: { api_function: 'parseResume' },
        contexts: {
          request: {
            quota_exceeded: error.quotaExceeded || false,
            file_type: resumeInput instanceof File ? resumeInput.type : 'text'
          }
        }
      });

      // Handle quota exceeded errors with user-friendly message
      if (error.quotaExceeded) {
        throw new Error(`Upload limit reached (${error.used}/${error.limit} used). Create a new account or upgrade for more uploads.`);
      }

      // Handle timeout/gateway errors with consistent messaging
      if (error.status === 502 || error.status === 504) {
        recordFailure('openrouter-ai');
        throw new Error('AI service is experiencing high load. We automatically retried but the request still timed out. Please try again in a moment.');
      }

      recordFailure('openrouter-ai');
      throw error;
    }
  }, 3, 2000); // 3 retries, 2s base delay
};

export const analyzeResumeWithAI = async (resumeText, jobDescription, language = 'en') => {
  if (!resumeText?.plainText && typeof resumeText !== "string") {
    throw new Error("Resume text is required");
  }

  const text = resumeText?.plainText || resumeText;
  if (!text?.trim()) {
    throw new Error("Resume text is required");
  }

  if (!jobDescription?.trim()) {
    throw new Error("Paste the job description");
  }

  if (isCircuitOpen('openrouter-ai')) {
    throw new Error('AI service is experiencing high load. Please wait 30 seconds and try again.');
  }

  return retryWithBackoff(async () => {
    try {
      const headers = await getAuthHeaders({ requireAuth: true });

      const response = await fetch(MATCH_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({ resumeText, jobText: jobDescription, language }),
      });

      const data = await handleResponse(response);

      recordSuccess('openrouter-ai');
      // Sanitize response to match expected frontend format and handle potential NaN/nulls
      return {
        ...data,
        score: Number.isFinite(Number(data.score)) ? Math.round(Math.min(100, Math.max(0, Number(data.score)))) : 0,
        coverage: Number.isFinite(Number(data.coverage)) ? Math.min(1, Math.max(0, Number(data.coverage))) : 0,
        similarity: Number.isFinite(Number(data.similarity)) ? Math.min(1, Math.max(0, Number(data.similarity))) : 0,
        cosine: Number.isFinite(Number(data.similarity)) ? Math.min(1, Math.max(0, Number(data.similarity))) : 0, // Legacy field
        topHits: data.matched_keywords || data.strongMatches || [],
        suggestions: data.recommendations || [],
        missingKeywords: data.missingKeywords || data.missing_keywords || [],
        reasoning: data.overallAssessment || data.explanation?.reason || null, // AI's explanation of the match score
        strategicRealityCheck: normalizeStrategicRealityCheck(data.strategicRealityCheck),
      };

    } catch (error) {
      console.error("Match failed:", summarizeErrorForConsole(error));

      // Enrich error with status for retry logic
      error.status = error.status || 500;

      // Capture error in Sentry (but skip for auth errors)
      if (error.status !== 401) {
        Sentry.captureException(error, {
          tags: { api_function: 'analyzeResumeWithAI' },
          contexts: {
            request: {
              quota_exceeded: error.quotaExceeded || false,
              has_resume: !!resumeText,
              has_job_desc: !!jobDescription,
              error_type: error.type || 'unknown'
            }
          }
        });
      }

      // Handle authentication errors
      if (error.status === 401 || error.type === 'AUTH_REQUIRED') {
        throw error;
      }

      // Handle quota exceeded
      if (error.quotaExceeded) {
        throw new Error(`Match analysis limit reached (${error.used}/${error.limit} used). Join the Pro waitlist for higher limits when paid plans launch.`);
      }

      // Handle timeout/gateway errors with better messaging
      if (error.status === 502 || error.status === 504) {
        recordFailure('openrouter-ai');
        throw new Error('AI service is experiencing high load. We automatically retried but the request still timed out. Please try again in a moment.');
      }

      recordFailure('openrouter-ai');
      // Re-throw the error so the caller (MainContent) can show proper failure notification
      // The UI needs to know when analysis fails to inform the user
      throw error;
    }
  }, 3, 2000); // 3 retries, 2s base delay
};

export const optimizeResume = async ({ resumeText, jobDesc, mode, preview, language = 'en', workHistory, userClarifications, userHardStops }) => {
  if (isCircuitOpen('openrouter-ai')) {
    throw new Error('AI service is experiencing high load. Please wait 30 seconds and try again.');
  }
  return retryWithBackoff(async () => {
    try {
      const headers = await getAuthHeaders({ requireAuth: true });

      const response = await fetch(OPTIMIZE_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({ resumeText, jobText: jobDesc, mode, preview, language, workHistory, userClarifications, userHardStops }),
      });

      const data = await handleResponse(response);
      recordSuccess('openrouter-ai');
      return data;

    } catch (error) {
      console.error("Optimization failed:", summarizeErrorForConsole(error));

      // Enrich error with status for retry logic
      error.status = error.status || 500;

      // Capture error in Sentry
      Sentry.captureException(error, {
        tags: { api_function: 'optimizeResume' },
        contexts: {
          request: {
            quota_exceeded: error.quotaExceeded || false,
            mode: mode || 'default',
            preview_mode: !!preview
          }
        }
      });

      // Handle quota exceeded errors with user-friendly message
      if (error.quotaExceeded) {
        throw new Error(`Optimization limit reached (${error.used}/${error.limit} used). Join the Pro waitlist for higher limits when paid plans launch.`);
      }

      // Handle timeout/gateway errors with consistent messaging
      if (error.status === 502 || error.status === 504) {
        recordFailure('openrouter-ai');
        throw new Error('AI service is experiencing high load. We automatically retried but the request still timed out. Please try again in a moment.');
      }

      recordFailure('openrouter-ai');
      throw error;
    }
  }, 3, 2000); // 3 retries, 2s base delay
};

/**
 * Refine a single optimized bullet from a short user instruction.
 * Grounds strictly on the resume text — never fabricates. If the instruction
 * asks to add unsupported content, the server returns the bullet unchanged with
 * an explanatory `issue`.
 *
 * @param {object} params
 * @param {string} params.original - the original (pre-optimization) bullet
 * @param {string} params.currentImproved - the current optimized bullet text
 * @param {string} params.userInstruction - short correction instruction
 * @param {string} [params.jobContext] - job description for keyword grounding
 * @param {string} params.resumeText - the ONLY grounding source
 * @param {string} [params.language='en']
 * @returns {Promise<{ improved: string, issue: string, rationale: string }>}
 */
export const refineBullet = async ({ original, currentImproved, userInstruction, jobContext = '', resumeText, language = 'en' }) => {
  if (isCircuitOpen('openrouter-ai')) {
    throw new Error('AI service is experiencing high load. Please wait 30 seconds and try again.');
  }
  return retryWithBackoff(async () => {
    try {
      const headers = await getAuthHeaders({ requireAuth: true });

      const response = await fetch(REFINE_BULLET_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify({ original, currentImproved, userInstruction, jobContext, resumeText, language }),
      });

      const data = await handleResponse(response);
      recordSuccess('openrouter-ai');
      return {
        improved: typeof data.improved === 'string' ? data.improved : currentImproved,
        issue: typeof data.issue === 'string' ? data.issue : '',
        rationale: typeof data.rationale === 'string' ? data.rationale : '',
      };
    } catch (error) {
      console.error('[RefineBullet] Refine failed:', summarizeErrorForConsole(error));
      error.status = error.status || 500;

      if (error.status !== 401) {
        Sentry.captureException(error, {
          tags: { api_function: 'refineBullet' },
          contexts: { request: { error_type: error.type || 'unknown' } },
        });
      }

      if (isAuthRequiredError(error)) {
        throw error;
      }

      if (error.status === 502 || error.status === 504) {
        recordFailure('openrouter-ai');
        throw new Error('AI service is experiencing high load. We automatically retried but the request still timed out. Please try again in a moment.');
      }

      recordFailure('openrouter-ai');
      throw error;
    }
  }, 2, 1500);
};

/**
 * Fetch 0–3 targeted clarification questions before optimization.
 * NON-FATAL: always resolves — returns { clarifications: [] } on any error.
 *
 * @param {object} params
 * @param {string} params.resumeText
 * @param {string} params.jobDesc
 * @param {string} [params.language='en']
 * @returns {Promise<{ clarifications: Array<{
 *   id: string,
 *   theme: string,
 *   rationale: string,
 *   question: string,
 *   type: 'single'|'multi',
 *   options: Array<{value: string, label: string, isHardStop?: boolean}>,
 *   allowOther: boolean,
 *   defaultValue?: string
 * }> }>}
 */
export const generateClarifications = async ({ resumeText, jobDesc, language = 'en' }) => {
  try {
    const headers = await getAuthHeaders({ requireAuth: true });
    const response = await fetch(CLARIFY_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ resumeText, jobText: jobDesc, language }),
    });
    if (!response.ok) {
      console.warn('[API] generateClarifications returned non-OK status:', response.status);
      return { clarifications: [] };
    }
    return await response.json();
  } catch (error) {
    if (isAuthRequiredError(error)) {
      throw error;
    }
    console.warn('[API] generateClarifications failed (non-fatal), proceeding without:', summarizeErrorForConsole(error));
    return { clarifications: [] };
  }
};

/**
 * SSE streaming version of optimizeResume.
 * Streams progress events from the server for real-time UX feedback.
 *
 * @param {object} params - Same params as optimizeResume
 * @param {function} onStatus - Callback for status events: (phase: string, extra?: object) => void
 * @returns {Promise<object>} - Same response shape as optimizeResume
 */
export const optimizeResumeStream = async ({ resumeText, jobDesc, mode, preview, language = 'en', workHistory, userClarifications, userHardStops }, onStatus) => {
  if (isCircuitOpen('openrouter-ai')) {
    throw new Error('AI service is experiencing high load. Please wait 30 seconds and try again.');
  }

  const headers = await getAuthHeaders({ requireAuth: true });
  // Remove Content-Type for SSE request compatibility — the body is still JSON
  // but we need to accept text/event-stream response
  const response = await fetch(OPTIMIZE_STREAM_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ resumeText, jobText: jobDesc, mode, preview, language, workHistory, userClarifications, userHardStops }),
  });

  // Non-streaming error responses (4xx, 5xx with JSON body) — server rejected before
  // processing started, so billing state is known-safe: no credits consumed.
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: response.statusText }));
    const error = new Error(data.error || 'Optimization failed');
    error.status = response.status;
    if (data.creditsRequired) error.creditsRequired = data.creditsRequired;
    if (data.creditsAvailable != null) error.creditsAvailable = data.creditsAvailable;
    attachErrorDebug(error, response, data);
    recordFailure('openrouter-ai');
    throw error;
  }

  // Cache hit: server returned JSON (Content-Type: application/json) instead of SSE.
  // This happens when the result is cached — no credits are consumed.
  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json().catch(() => null);
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      recordSuccess('openrouter-ai');
      return attachResponseDebug(data, response, data);
    }
  }

  // Parse SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events (delimited by \n\n)
      const events = buffer.split('\n\n');
      buffer = events.pop() || ''; // Keep incomplete event in buffer

      for (const eventBlock of events) {
        if (!eventBlock.trim()) continue;

        let eventType = '';
        let eventData = '';

        for (const line of eventBlock.split('\n')) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            eventData = line.slice(6);
          }
        }

        if (!eventType || !eventData) continue;

        try {
          const parsed = JSON.parse(eventData);

          switch (eventType) {
            case 'status':
              onStatus?.(parsed.phase, parsed);
              break;
            case 'result':
              result = attachResponseDebug(parsed, response, parsed);
              recordSuccess('openrouter-ai');
              break;
            case 'error': {
              // Server explicitly signals failure before processing (before credits consumed).
              // Billing state is known-safe — safe to fall back to legacy.
              const error = new Error(parsed.error);
              error.retryable = parsed.retryable;
              error.isBillingStateUnknown = false;
              attachErrorDebug(error, response, parsed);
              recordFailure('openrouter-ai');
              throw error;
            }
            case 'done':
              if (result && typeof parsed.durationMs === 'number') {
                result.debug = {
                  ...(result.debug || {}),
                  latencyMs: parsed.durationMs,
                };
              }
              console.log(`[optimize-stream] Complete in ${parsed.durationMs}ms`);
              break;
          }
        } catch (parseErr) {
          if (parseErr.retryable !== undefined) throw parseErr; // Re-throw SSE errors
          console.warn('[optimize-stream] Failed to parse SSE event:', eventType, summarizeErrorForConsole(parseErr));
        }
      }
    }
  } catch (streamErr) {
    if (streamErr.isBillingStateUnknown === false) {
      throw streamErr;
    }
    if (result) {
      // Stream broke after result was received — credits already consumed on server.
      // Return what we have rather than losing it.
      console.warn('[optimize-stream] Stream closed after result received:', streamErr.message);
      return result;
    }
    // Stream broke before result — billing state is unknown (credits may have been consumed).
    // Caller must NOT automatically retry with another paid request.
    streamErr.isBillingStateUnknown = true;
    throw streamErr;
  } finally {
    reader.releaseLock();
  }

  if (!result) {
    // Stream ended gracefully without a result event — billing state unknown.
    const err = new Error('SSE stream ended without a result event');
    err.isBillingStateUnknown = true;
    throw err;
  }

  return result;
};

export const analyzeVision2030 = async (resumeText, language = 'en', jobDescription = null) => {
  if (!resumeText?.plainText && typeof resumeText !== "string") {
    throw new Error("Resume text is required");
  }

  const text = resumeText?.plainText || resumeText;
  if (!text?.trim()) {
    throw new Error("Resume text is required");
  }

  return retryWithBackoff(async () => {
    try {
      const headers = await getAuthHeaders({ requireAuth: true });

      const response = await fetch(VISION2030_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({
          resumeText: text,
          language: language || 'en',
          jobDescription: jobDescription || undefined
        }),
      });

      const data = await handleResponse(response);
      return data;

    } catch (error) {
      console.error("Vision 2030 alignment analysis failed:", summarizeErrorForConsole(error));

      // Enrich error with status for retry logic
      error.status = error.status || 500;

      // Capture error in Sentry
      Sentry.captureException(error, {
        tags: { api_function: 'analyzeVision2030' },
        contexts: {
          request: {
            quota_exceeded: error.quotaExceeded || false,
            language: language || 'en',
            has_job_description: !!jobDescription
          }
        }
      });

      // Handle insufficient credits error
      if (error.message?.includes('Insufficient credits')) {
        throw new Error('You need 2 credits to analyze Vision 2030 alignment. Please purchase more credits.');
      }

      throw error;
    }
  }, 3, 2000); // 3 retries, 2s base delay
};

export const analyzeResumeTruthCheck = async ({ resumeText, language = 'en' }) => {
  const text = resumeText?.plainText || resumeText;
  if (!text?.trim()) {
    throw new Error("Resume text is required");
  }

  if (isCircuitOpen('openrouter-ai')) {
    throw new Error('AI service is experiencing high load. Please wait 30 seconds and try again.');
  }

  return retryWithBackoff(async () => {
    try {
      const headers = await getAuthHeaders({ requireAuth: true });

      const response = await fetch(TRUTH_CHECK_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({ resumeText: text, language }),
      });

      const data = await handleResponse(response);
      recordSuccess('openrouter-ai');
      return {
        overallRisk: ['low', 'medium', 'high'].includes(data.overallRisk) ? data.overallRisk : 'medium',
        summary: typeof data.summary === 'string' ? data.summary : '',
        claims: Array.isArray(data.claims) ? data.claims : [],
        limits: {
          cannotVerify: Array.isArray(data.limits?.cannotVerify) ? data.limits.cannotVerify : [],
        },
        debug: data.debug,
      };
    } catch (error) {
      console.error("Resume Truth Check failed:", summarizeErrorForConsole(error));
      error.status = error.status || 500;

      if (error.status !== 401) {
        Sentry.captureException(error, {
          tags: { api_function: 'analyzeResumeTruthCheck' },
          contexts: {
            request: {
              has_resume: !!text,
              error_type: error.type || 'unknown'
            }
          }
        });
      }

      if (isAuthRequiredError(error)) {
        throw error;
      }

      if (error.status === 502 || error.status === 504) {
        recordFailure('openrouter-ai');
        throw new Error('AI service is experiencing high load. We automatically retried but the request still timed out. Please try again in a moment.');
      }

      recordFailure('openrouter-ai');
      throw error;
    }
  }, 3, 2000);
};



export const extractJobMetadata = async (jobText, language = 'en') => {
  try {
    const headers = await getAuthHeaders({ requireAuth: true });
    const response = await fetch(FUNCTION_BASE_PATH + '/extract-job-metadata', {
      method: 'POST',
      headers,
      body: JSON.stringify({ jobText, language }),
    });

    if (!response.ok) {
      console.warn('[API] extractJobMetadata returned non-OK status:', response.status);
      return {
        companyName: null,
        jobTitle: null,
        location: null,
        employmentType: null,
        seniority: null,
        sector: null,
        confidence: { companyName: 0, jobTitle: 0, location: 0 },
        needsUserConfirmation: true,
      };
    }

    const data = await response.json();
    return {
      companyName: data.companyName || null,
      jobTitle: data.jobTitle || null,
      location: data.location || null,
      employmentType: data.employmentType || null,
      seniority: data.seniority || null,
      sector: data.sector || null,
      confidence: data.confidence || { companyName: 0, jobTitle: 0, location: 0 },
      needsUserConfirmation: data.needsUserConfirmation ?? true,
    };
  } catch (error) {
    console.warn('[API] extractJobMetadata failed (non-fatal):', summarizeErrorForConsole(error));
    return {
      companyName: null,
      jobTitle: null,
      location: null,
      employmentType: null,
      seniority: null,
      sector: null,
      confidence: { companyName: 0, jobTitle: 0, location: 0 },
      needsUserConfirmation: true,
    };
  }
};

// Legacy exports to prevent breaking imports if any remain
export const analyzeResume = analyzeResumeWithAI;
