// src/services/api.js
import { supabase } from './supabase';
import * as Sentry from '@sentry/react';
import { isCircuitOpen, recordFailure, recordSuccess } from '../lib/utils/circuit-breaker';

const FUNCTION_BASE_PATH = "/.netlify/functions";
const MATCH_ENDPOINT = `${FUNCTION_BASE_PATH}/ai-match`;
const PARSE_ENDPOINT = `${FUNCTION_BASE_PATH}/extract-resume-json`;
const OPTIMIZE_ENDPOINT = `${FUNCTION_BASE_PATH}/optimize`;
const VISION2030_ENDPOINT = `${FUNCTION_BASE_PATH}/vision2030-alignment`;
export const AI_DEFAULT_TEMPERATURE = 0.4;

// Helper to get auth headers
export const getAuthHeaders = async () => {
  const headers = { "Content-Type": "application/json" };

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.warn('[API] Failed to retrieve auth session:', sessionError.message);
    }

    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    } else {
      console.warn('[API] No active session found - request will be sent without authentication');
    }
  } catch (error) {
    console.error('[API] Unexpected error retrieving auth session:', error);
    // Don't throw - allow the endpoint to decide if auth is required
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
    error.retryAfter = retryAfter;
    error.status = 429;
    throw error;
  }

  // Handle authentication errors
  if (response.status === 401) {
    const error = new Error(data.error || "Authentication required. Please sign in again.");
    error.status = 401;
    error.type = 'AUTH_REQUIRED';
    throw error;
  }

  // Handle Bad Gateway errors (502) - often caused by timeouts
  if (response.status === 502) {
    const error = new Error(data.error || "Service temporarily unavailable. Retrying automatically...");
    error.status = 502;
    error.type = 'BAD_GATEWAY';
    error.retryable = true;
    throw error;
  }

  // Handle Gateway Timeout errors (504)
  if (response.status === 504) {
    const error = new Error(data.error || "Request timed out. Retrying automatically...");
    error.status = 504;
    error.type = 'GATEWAY_TIMEOUT';
    error.retryable = true;
    throw error;
  }

  if (!response.ok) {
    // Preserve quota metadata from error response
    const error = new Error(data.error || "Request failed");
    error.status = response.status;

    if (data.quotaExceeded) {
      error.quotaExceeded = true;
      error.used = data.used;
      error.limit = data.limit;
      error.remaining = data.remaining;
      error.action = data.action;
    }
    throw error;
  }

  return data;
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
        const base64 = await fileToBase64(resumeInput);
        // Include filename and mime type for better server-side text extraction
        payload = {
          kind: "file",
          data: base64,
          name: resumeInput.name,
          mime: resumeInput.type,
        };
      } else {
        payload = { kind: "text", value: resumeInput };
      }

      const headers = await getAuthHeaders();

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

      console.error("Parse failed:", error);

      // Enrich error with status for retry logic
      error.status = error.status || 500;

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
      const headers = await getAuthHeaders();

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
      };

    } catch (error) {
      console.error("Match failed:", error);

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
        throw new Error('Authentication expired. Please sign out and sign in again.');
      }

      // Handle quota exceeded
      if (error.quotaExceeded) {
        throw new Error(`Match analysis limit reached (${error.used}/${error.limit} used). Upgrade your account for unlimited analyses.`);
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

export const optimizeResume = async ({ resumeText, jobDesc, mode, preview, language = 'en' }) => {
  if (isCircuitOpen('openrouter-ai')) {
    throw new Error('AI service is experiencing high load. Please wait 30 seconds and try again.');
  }
  return retryWithBackoff(async () => {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(OPTIMIZE_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({ resumeText, jobText: jobDesc, mode, preview, language }),
      });

      const data = await handleResponse(response);
      recordSuccess('openrouter-ai');
      return data;

    } catch (error) {
      console.error("Optimization failed:", error);

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
        throw new Error(`Optimization limit reached (${error.used}/${error.limit} used). Upgrade your account for unlimited optimizations.`);
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
      const headers = await getAuthHeaders();

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
      console.error("Vision 2030 alignment analysis failed:", error);

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

// Legacy exports to prevent breaking imports if any remain
export const analyzeResume = analyzeResumeWithAI;




