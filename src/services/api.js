// src/services/api.js

const FUNCTION_BASE_PATH = "/.netlify/functions";
const MATCH_ENDPOINT = `${FUNCTION_BASE_PATH}/match-score`;
const OPTIMIZE_ENDPOINT = `${FUNCTION_BASE_PATH}/optimize`;
const REQUEST_TIMEOUT = 15000;

const createTimeoutController = (timeout = REQUEST_TIMEOUT) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return { controller, timer };
};

const handleResponse = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error || payload?.message || "Request failed";
    throw new Error(message);
  }
  return payload;
};

const sanitizeText = (value) => (typeof value === "string" ? value.trim() : "");

export const parseResume = async (resumeText) => {
  const content = sanitizeText(resumeText);
  if (!content) {
    throw new Error("Unable to parse resume content.");
  }
  return content.replace(/\s+/g, " ").trim();
};

export const analyzeResume = async (resumeText, jobText, options = {}) => {
  const resume = sanitizeText(resumeText);
  const job = sanitizeText(jobText);

  if (!resume) {
    throw new Error("Resume text is required for analysis.");
  }

  if (!job) {
    throw new Error("Paste the job description to analyze the match.");
  }

  const { controller, timer } = createTimeoutController();

  try {
    const response = await fetch(MATCH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeText: resume,
        resumeFileId: options.resumeFileId,
        jobDesc: job,
      }),
      signal: controller.signal,
    });

    const data = await handleResponse(response);
    const topMissing = Array.isArray(data?.explanations?.topMissing)
      ? data.explanations.topMissing.slice(0, 6)
      : [];
    const topHits = Array.isArray(data?.explanations?.topHits)
      ? data.explanations.topHits.slice(0, 6)
      : [];
    const coverage = Number(data?.explanations?.coverage ?? 0);
    const cosine = Number(data?.explanations?.cosine ?? 0);

    const suggestions = topMissing.map(
      (keyword) => `Consider highlighting “${keyword}” to better reflect the role requirements.`,
    );

    return {
      score: Number.isFinite(data?.score) ? data.score : 0,
      missingKeywords: topMissing,
      suggestions,
      topHits,
      coverage,
      cosine,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Match analysis timed out. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

export const optimizeResume = async ({ resumeText, jobDesc, mode = "auto", preview = false }) => {
  const resume = sanitizeText(resumeText);
  const job = sanitizeText(jobDesc);

  if (!resume || !job) {
    throw new Error("Provide both resume text and job description before optimizing.");
  }

  const { controller, timer } = createTimeoutController();

  try {
    const response = await fetch(OPTIMIZE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText: resume, jobDesc: job, mode, preview }),
      signal: controller.signal,
    });

    const data = await handleResponse(response);

    return {
      cards: Array.isArray(data?.cards) ? data.cards : [],
      keywords: data?.keywords ?? { add: [], remove: [], neutral: [] },
      source: data?.source ?? "mock",
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Optimization request timed out. Try again shortly.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};
