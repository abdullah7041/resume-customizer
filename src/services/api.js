// src/services/api.js
import { updateDevStatus } from "../components/DevStatusHUD";

const FUNCTION_BASE_PATH = "/.netlify/functions";
const MATCH_ENDPOINT = `${FUNCTION_BASE_PATH}/ai-match`;
const PARSE_ENDPOINT = `${FUNCTION_BASE_PATH}/extract-resume-json`;
const OPTIMIZE_ENDPOINT = `${FUNCTION_BASE_PATH}/optimize`;
export const AI_DEFAULT_TEMPERATURE = 0.4;

// Helper to handle responses
const handleResponse = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
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
  updateDevStatus("OCR_UPDATE", { status: "parsing", text: "" });

  try {
    let payload;
    if (resumeInput instanceof File) {
      const base64 = await fileToBase64(resumeInput);
      payload = { kind: "file", data: base64 };
    } else {
      payload = { kind: "text", value: resumeInput };
    }

    const response = await fetch(PARSE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await handleResponse(response);

    updateDevStatus("OCR_UPDATE", { status: "success", text: data.document.plainText });
    return data.document;

  } catch (error) {
    updateDevStatus("OCR_UPDATE", { status: "error", text: "" });
    console.error("Parse failed:", error);
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

  updateDevStatus("API_UPDATE", { status: "active", lastOp: "AI Match", model: "gemini-2.5-flash-lite" });

  try {
    const response = await fetch(MATCH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText, jobDesc: jobDescription }),
    });

    const data = await handleResponse(response);

    updateDevStatus("API_UPDATE", { status: "idle", lastOp: "Match Complete", model: "gemini-2.5-flash-lite" });

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
    };

  } catch (error) {
    updateDevStatus("API_UPDATE", { status: "error", lastOp: "Match Failed" });
    console.error("Match failed:", error);
    // Return graceful failure object to prevent app crash
    return {
      score: 0,
      coverage: 0,
      similarity: 0,
      missingKeywords: [],
      strongMatches: [],
      recommendations: [],
      overallAssessment: "Analysis failed",
      explanation: { reason: "Could not complete analysis.", tips: [] }
    };
  }
};

export const optimizeResume = async ({ resumeText, jobDesc }) => {
  updateDevStatus("API_UPDATE", { status: "active", lastOp: "Optimizing", model: "gemini-2.5-flash-lite" });

  try {
    const response = await fetch(OPTIMIZE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText, jobText: jobDesc }),
    });

    const data = await handleResponse(response);

    updateDevStatus("API_UPDATE", { status: "idle", lastOp: "Optimization Complete", model: "gemini-2.5-flash-lite" });
    return data;

  } catch (error) {
    updateDevStatus("API_UPDATE", { status: "error", lastOp: "Optimization Failed" });
    console.error("Optimization failed:", error);
    throw error;
  }
};

// Legacy exports to prevent breaking imports if any remain
export const analyzeResume = analyzeResumeWithAI;
