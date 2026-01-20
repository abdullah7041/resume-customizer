// src/services/api.js
import { supabase } from './supabase';

const FUNCTION_BASE_PATH = "/.netlify/functions";
const MATCH_ENDPOINT = `${FUNCTION_BASE_PATH}/ai-match`;
const PARSE_ENDPOINT = `${FUNCTION_BASE_PATH}/extract-resume-json`;
const OPTIMIZE_ENDPOINT = `${FUNCTION_BASE_PATH}/optimize`;
export const AI_DEFAULT_TEMPERATURE = 0.4;

// Helper to get beta code from localStorage
const getBetaCode = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('watheq:beta_access');
};

// Helper to get auth headers
const getAuthHeaders = async () => {
  const headers = { "Content-Type": "application/json" };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch (error) {
    // Silent fail - auth is optional for most endpoints
    void error;
  }

  return headers;
};

// Helper to handle responses
const handleResponse = async (response) => {
  // Handle rate limiting (429 Too Many Requests)
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
    throw {
      type: 'RATE_LIMITED',
      retryAfter,
      message: `Too many requests. Please wait ${retryAfter} seconds.`,
    };
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Preserve quota metadata from error response
    const error = new Error(data.error || "Request failed");
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

export const parseResume = async (resumeInput) => {
  try {
    const betaCode = getBetaCode();

    if (!betaCode) {
      throw new Error("Beta code not found. Please sign in again.");
    }

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

    const response = await fetch(PARSE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Beta-Code": betaCode
      },
      body: JSON.stringify(payload),
    }).catch(err => {
      // Handle network errors (like Connection Refused)
      if (err.message === "Failed to fetch") {
        throw new Error("Could not connect to the server. Please ensure the Netlify Dev server is running (npm run dev:netlify) and try again.");
      }
      throw err;
    });

    const data = await handleResponse(response);
    return data.document;

  } catch (error) {
    console.error("Parse failed:", error);

    // Handle quota exceeded errors with user-friendly message
    if (error.quotaExceeded) {
      throw new Error(`Upload limit reached (${error.used}/${error.limit} used). Each beta code allows ${error.limit} uploads.`);
    }

    throw error;
  }
};

export const analyzeResumeWithAI = async (resumeText, jobDescription) => {
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

  try {
    const betaCode = getBetaCode();

    if (!betaCode) {
      throw new Error("Beta code not found. Please sign in again.");
    }

    const headers = await getAuthHeaders();
    headers["X-Beta-Code"] = betaCode;

    const response = await fetch(MATCH_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({ resumeText, jobDesc: jobDescription }),
    });

    const data = await handleResponse(response);

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

    // Handle quota exceeded
    if (error.quotaExceeded) {
      throw new Error(`Match analysis limit reached (${error.used}/${error.limit} used). Each beta code allows ${error.limit} analyses.`);
    }

    // Re-throw the error so the caller (MainContent) can show proper failure notification
    // The UI needs to know when analysis fails to inform the user
    throw error;
  }
};

export const optimizeResume = async ({ resumeText, jobDesc, mode, preview }) => {
  try {
    const betaCode = getBetaCode();

    if (!betaCode) {
      throw new Error("Beta code not found. Please sign in again.");
    }

    const headers = await getAuthHeaders();
    headers["X-Beta-Code"] = betaCode;

    const response = await fetch(OPTIMIZE_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({ resumeText, jobText: jobDesc, mode, preview }),
    });

    const data = await handleResponse(response);
    return data;

  } catch (error) {
    console.error("Optimization failed:", error);

    // Handle quota exceeded errors with user-friendly message
    if (error.quotaExceeded) {
      throw new Error(`Optimization limit reached (${error.used}/${error.limit} used). Each beta code allows ${error.limit} optimizations.`);
    }

    throw error;
  }
};

// Legacy exports to prevent breaking imports if any remain
export const analyzeResume = analyzeResumeWithAI;




