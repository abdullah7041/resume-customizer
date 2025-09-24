// src/services/api.js

import { runOptimization, USE_MOCK } from "../lib/aiClient";

export const AI_DEFAULT_TEMPERATURE = 1;

const FUNCTION_BASE_PATH = "/.netlify/functions";
const MATCH_ENDPOINT = `${FUNCTION_BASE_PATH}/match-score`;
const REQUEST_TIMEOUT = 15000;

const sanitize = (value) => {
  let buffer = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    buffer += code < 32 || code === 127 ? " " : char;
  }
  return buffer.trim();
};

const tokenize = (input) =>
  input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9]+/g)
    ?.filter((token) => !STOPWORDS.has(token) && token.length > 2) ?? [];

const pickKeywords = (jobDesc, resumeText) => {
  const jobTokens = tokenize(jobDesc);
  const resumeTokens = new Set(tokenize(resumeText));
  const counts = new Map();
  for (const token of jobTokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const add = [];
  const neutral = [];
  for (const [token] of ranked) {
    if (add.length < 6 && !resumeTokens.has(token)) {
      add.push(token);
    } else if (neutral.length < 6 && resumeTokens.has(token)) {
      neutral.push(token);
    }
    if (add.length >= 6 && neutral.length >= 6) break;
  }
  return { add, neutral, remove: [] };
};

const buildMockCards = (resumeText, jobDesc, mode) => {
  const keywords = pickKeywords(jobDesc, resumeText);
  const toneMap = {
    auto: "balanced",
    conservative: "measured",
    aggressive: "impactful",
  };
  const tone = toneMap[mode ?? "auto"] ?? "balanced";
  const baseSections = ["Summary", "Experience", "Skills", "Achievements", "Leadership"];
  const cards = baseSections.slice(0, 4).map((section, index) => {
    const keyword = keywords.add[index] ?? keywords.neutral[index] ?? "impact";
    const descriptor = tone === "impactful" ? "powerful" : tone === "measured" ? "grounded" : "clear";
    return {
      section,
      issue: `${section} lacks a ${descriptor} mention of ${keyword}.`,
      suggestion: `Integrate a ${descriptor} bullet that highlights ${keyword} with metrics tied to Saudi market outcomes.`,
      exampleBefore: `Led initiatives without explicit ${keyword} framing.`,
      exampleAfter: `Orchestrated ${keyword}-focused programs that delivered 18% uplift in product adoption across Riyadh.`,
    };
  });

  if (cards.length < 3) {
    cards.push({
      section: "Summary",
      issue: "Summary feels generic for Saudi employers.",
      suggestion: "Anchor the opening statement to digital transformation outcomes and Vision 2030 alignment.",
      exampleBefore: "Experienced professional seeking new opportunities.",
      exampleAfter: "Saudi fintech strategist translating Vision 2030 mandates into scalable, customer-first platforms.",
    });
  }

  return {
    cards,
    keywords,
    source: "mock",
  };
};

const buildPrompt = (resumeText, jobDesc, mode = "auto") =>
  `You rewrite resumes for the Saudi market using ATS-safe language. Return ONLY JSON with keys cards (array) and keywords (object). ` +
  `cards[].section, cards[].issue, cards[].suggestion, cards[].exampleBefore, cards[].exampleAfter must all be non-empty strings. ` +
  `keywords must include add, remove, neutral arrays. Keep bullets concise, metric-driven, and culturally neutral.` +
  `\n\nMODE: ${mode}\n\nRESUME:\n${resumeText.slice(0, 4000)}\n\nJOB DESCRIPTION:\n${jobDesc.slice(0, 4000)}`;

const buildMessages = (resumeText, jobDesc, mode = "auto") => {
  const system =
    "You are a resume optimization assistant. Output strictly valid JSON conforming to the provided schema.";
  return [
    {
      role: "system",
      content: [
        {
          type: "text",
          text: system,
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: buildPrompt(resumeText, jobDesc, mode),
        },
      ],
    },
  ];
};

const safeJson = (value) => {
  if (typeof value !== "string") return {};
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const segment = value.slice(start, end + 1);
    try {
      return JSON.parse(segment);
    } catch {
      return {};
    }
  }
  return {};
};

const toPayload = (value) => {
  const fallback = buildMockCards("", "", "auto");
  if (!value || typeof value !== "object") return fallback;
  const maybe = value;
  const cards = Array.isArray(maybe.cards)
    ? maybe.cards
        .slice(0, 6)
        .map((card) => ({
          section: sanitize(String(card.section ?? "Summary")),
          issue: sanitize(String(card.issue ?? "")),
          suggestion: sanitize(String(card.suggestion ?? "")),
          exampleBefore: sanitize(String(card.exampleBefore ?? "")),
          exampleAfter: sanitize(String(card.exampleAfter ?? "")),
        }))
        .filter((card) => card.suggestion.length > 0)
    : fallback.cards;

  const keywords = maybe.keywords && typeof maybe.keywords === "object"
    ? {
        add: Array.isArray(maybe.keywords.add)
          ? maybe.keywords.add.map((item) => sanitize(String(item))).filter(Boolean).slice(0, 10)
          : [],
        remove: Array.isArray(maybe.keywords.remove)
          ? maybe.keywords.remove.map((item) => sanitize(String(item))).filter(Boolean).slice(0, 10)
          : [],
        neutral: Array.isArray(maybe.keywords.neutral)
          ? maybe.keywords.neutral.map((item) => sanitize(String(item))).filter(Boolean).slice(0, 10)
          : [],
      }
    : fallback.keywords;

  return {
    cards: cards.length > 0 ? cards : fallback.cards,
    keywords,
    source: maybe.source === "openai" ? "openai" : fallback.source,
  };
};

const STOPWORDS = new Set([
  "a",
  "about",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "to",
  "with",
]);

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

export const optimizeResume = async (
  { resumeText, jobDesc, mode = "auto", preview = false },
  clientOptions = {},
) => {
  const resume = sanitizeText(resumeText);
  const job = sanitizeText(jobDesc);

  if (!resume || !job) {
    throw new Error("Provide both resume text and job description before optimizing.");
  }

  const { controller, timer } = createTimeoutController();
  const canUseMock = import.meta.env.MODE === "development" && USE_MOCK;

  try {
    const payload = {
      resumeText: resume.slice(0, 4000),
      jobText: job.slice(0, 4000),
      mode,
      preview,
      temperature: AI_DEFAULT_TEMPERATURE,
      messages: buildMessages(resume, job, mode),
    };

    const result = await runOptimization(
      payload,
      {
        signal: controller.signal,
        onError: clientOptions.onError,
        onDebug: clientOptions.onDebug,
      },
    );

    if (!result.text) {
      if (canUseMock) {
        const fallback = buildMockCards(resume, job, mode);
        clientOptions.onDebug?.({ status: "success", model: "mock", tokens: null });
        return fallback;
      }
      throw new Error("AI response was empty.");
    }

    const parsed = safeJson(result.text);
    const parsedPayload = toPayload(parsed);
    return { ...parsedPayload, source: "openai" };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Optimization request timed out. Try again shortly.");
    }
    if (canUseMock) {
      const fallback = buildMockCards(resume, job, mode);
      clientOptions.onDebug?.({ status: "success", model: "mock", tokens: null });
      return fallback;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};
