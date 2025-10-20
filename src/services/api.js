// src/services/api.js

import { runOptimization, USE_MOCK } from "../lib/aiClient";

export const AI_DEFAULT_MODEL = "gpt-5-nano";
export const AI_DEFAULT_TEMPERATURE = 1;
export const AI_DEFAULT_MAX_TOKENS = 2048;

const FUNCTION_BASE_PATH = "/.netlify/functions";
const MATCH_ENDPOINT = `${FUNCTION_BASE_PATH}/match-score`;
const PARSE_ENDPOINT = `${FUNCTION_BASE_PATH}/parse-resume`;
const REQUEST_TIMEOUT = 15000;
const OPTIMIZATION_TIMEOUT = 45000;

const clampScore = (value) => {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(numeric)));
};

const clampRatio = (value) => {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  if (numeric <= 0) return 0;
  if (numeric >= 1) return 1;
  return numeric;
};

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

const GENERIC_JOB_TOKENS = new Set([
  "candidate",
  "career",
  "description",
  "experience",
  "job",
  "opportunity",
  "profile",
  "resume",
  "role",
  "some",
  "summary",
]);

const buildTokenOverlap = (resumeText, jobDesc) => {
  const resumeTokens = new Set(tokenize(resumeText));
  const jobTokens = tokenize(jobDesc);
  if (jobTokens.length === 0 || resumeTokens.size === 0) {
    return {
      uniqueJobTokens: [],
      matchedTokens: [],
      missingTokens: [],
    };
  }

  const uniqueJobTokens = Array.from(new Set(jobTokens));
  const informativeTokens = uniqueJobTokens.filter((token) => !GENERIC_JOB_TOKENS.has(token));
  if (informativeTokens.length === 0) {
    return { uniqueJobTokens: [], matchedTokens: [], missingTokens: [] };
  }

  const matchedTokens = informativeTokens.filter((token) => resumeTokens.has(token));
  const missingTokens = informativeTokens.filter((token) => !resumeTokens.has(token));

  return { uniqueJobTokens: informativeTokens, matchedTokens, missingTokens };
};

const buildFallbackMatch = (resumeText, jobDesc) => {
  const { uniqueJobTokens, matchedTokens, missingTokens } = buildTokenOverlap(resumeText, jobDesc);
  if (uniqueJobTokens.length === 0) {
    return null;
  }

  const coverage = matchedTokens.length / uniqueJobTokens.length;
  const cosine = coverage > 0 ? Math.min(1, Math.sqrt(coverage)) : 0;
  const baseScore = 32 + coverage * 58;
  const score = Math.round(Math.min(94, Math.max(22, baseScore)));

  return {
    coverage,
    cosine,
    score,
    missingKeywords: missingTokens.slice(0, 12),
    matchedKeywords: matchedTokens.slice(0, 12),
  };
};

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
  `You are a resume optimization assistant for the Saudi job market. Analyze the resume and suggest improvements based on the job description.

CRITICAL RULES - STRICT ENFORCEMENT:
1. ONLY use information explicitly stated in the resume - DO NOT invent or hallucinate facts
2. DO NOT add degrees, certifications, or experiences that aren't in the resume
3. DO NOT fabricate company names, dates, or achievements
4. ONLY suggest rewording existing content, never adding fictional information
5. Each card MUST address a DIFFERENT section - NO REPETITION between cards
6. Use the ACTUAL section names from the resume (e.g., "Professional Summary", "Work Experience", "Technical Skills")
7. exampleBefore MUST be EXACT text copied from the resume (word-for-word)
8. exampleAfter MUST preserve all factual details while improving clarity and impact
9. Add quantifiable metrics ONLY if they logically fit existing achievements (e.g., "led team" → "led team of 5")
10. Return ONLY valid JSON with no markdown, explanations, or extra text

Required JSON structure:
{
  "cards": [
    {
      "section": "string (use EXACT section name from resume: Summary|Professional Summary|Experience|Work Experience|Skills|Technical Skills|Education|Certifications|etc)",
      "issue": "string (specific weakness in THIS section that affects job match - be precise, not generic)",
      "suggestion": "string (actionable improvement using ONLY existing resume facts - explain WHY this helps)",
      "exampleBefore": "string (EXACT verbatim text from the resume - copy word-for-word)",
      "exampleAfter": "string (improved version preserving ALL facts, adding job-relevant keywords, using stronger action verbs)"
    }
  ],
  "keywords": {
    "add": ["string array of 3-8 missing keywords from job description that candidate could realistically have"],
    "neutral": ["string array of 3-5 keywords already present in resume"],
    "remove": ["string array of 1-3 keywords to de-emphasize if irrelevant to job"]
  }
}

DIVERSITY REQUIREMENT:
- Card 1: Focus on Summary/Objective section
- Card 2: Focus on most recent Work Experience bullet
- Card 3: Focus on Skills section alignment with job requirements
- Card 4: Focus on earlier Work Experience or Projects
- Card 5: Focus on Education/Certifications relevance
- Card 6: Focus on formatting/ATS optimization or additional experience

Each card must target a DIFFERENT aspect. Do NOT repeat the same section or issue.

MODE: ${mode}
Keep suggestions concise, metric-driven, and ATS-safe. Prioritize changes that directly match job requirements.

RESUME:
${resumeText.slice(0, 4000)}

JOB DESCRIPTION:
${jobDesc.slice(0, 4000)}`;

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

const fileToBase64 = async (file) => {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  if (typeof btoa === "function") {
    return btoa(binary);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  throw new Error("Base64 encoding not supported in this environment.");
};

const requestMatchExplanation = async ({
  resume,
  job,
  score,
  coverage,
  similarity,
}) => {
  try {
    const system =
      "You are a resume analyst. Respond with strict JSON {reason: string, tips: string[]} explaining the match score.";
    const prompt =
      `SCORE:${score}\nCOVERAGE:${coverage}\nSIMILARITY:${similarity}\n\nRESUME:\n${resume.slice(0, 2000)}\n\nJOB:\n${job.slice(0, 2000)}`;
    const result = await runOptimization({
      messages: [
        {
          role: "system",
          content: [{ type: "text", text: system }],
        },
        {
          role: "user",
          content: [{ type: "text", text: prompt }],
        },
      ],
      temperature: 0.2,
      max_output_tokens: 480,
    });

    const parsed = safeJson(result.text);
    if (!parsed || typeof parsed !== "object") return null;
    const reason = typeof parsed.reason === "string" ? parsed.reason.trim() : "";
    const tips = Array.isArray(parsed.tips)
      ? parsed.tips.map((tip) => sanitize(String(tip))).filter(Boolean).slice(0, 4)
      : [];
    if (!reason && tips.length === 0) {
      return null;
    }
    return { reason, tips };
  } catch {
    return null;
  }
};

const isFile = (value) =>
  typeof File !== "undefined" && value instanceof File;

export const parseResume = async (resumeInput) => {
  if (!resumeInput) {
    throw new Error("Unable to parse resume content.");
  }

  const payload = await (async () => {
    if (isFile(resumeInput)) {
      const encoded = await fileToBase64(resumeInput);
      return {
        kind: "file",
        name: resumeInput.name,
        mime: resumeInput.type,
        data: encoded,
      };
    }

    if (typeof resumeInput === "string") {
      const trimmed = resumeInput.trim();
      if (!trimmed) {
        throw new Error("Unable to parse resume content.");
      }
      if (trimmed.startsWith("%PDF")) {
        throw new Error("This looks like a PDF — use Upload.");
      }
      return { kind: "text", value: trimmed };
    }

    throw new Error("Unsupported resume input.");
  })();

  const response = await fetch(PARSE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await handleResponse(response);
  const document = data?.document;

  if (!document || typeof document !== "object" || !document.plainText) {
    throw new Error("Unable to parse resume content.");
  }

  return {
    plainText: String(document.plainText),
    bullets: Array.isArray(document.bullets) ? document.bullets.map((item) => sanitize(String(item))) : [],
    sections: Array.isArray(document.sections)
      ? document.sections
          .map((section) => ({
            id: sanitize(String(section.id ?? "")) || null,
            title: sanitize(String(section.title ?? "")) || null,
            content: Array.isArray(section.content)
              ? section.content.map((item) => sanitize(String(item))).filter(Boolean)
              : [],
          }))
          .filter((section) => section.title || section.content.length > 0)
      : [],
  };
};

export const analyzeResume = async (resumeInput, jobText, options = {}) => {
  const resume = sanitizeText(
    typeof resumeInput === "string" ? resumeInput : resumeInput?.plainText ?? "",
  );
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
    const topMissingRaw = Array.isArray(data?.missing_keywords)
      ? data.missing_keywords.map((item) => sanitize(String(item))).filter(Boolean)
      : [];
    const topHitsRaw = Array.isArray(data?.matched_keywords)
      ? data.matched_keywords.map((item) => sanitize(String(item))).filter(Boolean)
      : [];
    const coverageResponse = clampRatio(data?.coverage);
    const cosineResponse = clampRatio(data?.similarity);
    const scoreResponse = clampScore(data?.score);

    const fallback = buildFallbackMatch(resume, job);
    
    // Use fallback if:
    // 1. All metrics are 0 but fallback shows overlap exists
    // 2. Score is unrealistically low (< 10) when fallback shows substantial overlap (> 15%)
    const allZero = scoreResponse === 0 && coverageResponse === 0 && cosineResponse === 0;
    const unrealisticScore = scoreResponse > 0 && scoreResponse < 10 && fallback && fallback.coverage > 0.15;
    const shouldFallback = fallback && fallback.coverage > 0 && (allZero || unrealisticScore);

    const coverage = shouldFallback ? fallback.coverage : coverageResponse;
    const cosine = shouldFallback ? fallback.cosine : cosineResponse;
    const score = shouldFallback ? fallback.score : scoreResponse;
    const fallbackMissing = fallback?.missingKeywords ?? [];
    const fallbackHits = fallback?.matchedKeywords ?? [];
    const topMissing = topMissingRaw.length > 0 ? topMissingRaw : fallbackMissing;
    const topHits = topHitsRaw.length > 0 ? topHitsRaw : fallbackHits;

    const suggestions = topMissing.slice(0, 6).map(
      (keyword) => `Consider highlighting “${keyword}” to better reflect the role requirements.`,
    );

    const baseResult = {
      score,
      missingKeywords: topMissing.slice(0, 12),
      suggestions,
      topHits: topHits.slice(0, 12),
      coverage,
      cosine,
    };

    if (options.explain) {
      const explanation = await requestMatchExplanation({
        resume,
        job,
        score: baseResult.score,
        coverage,
        similarity: cosine,
      });
      if (explanation) {
        return { ...baseResult, explanation };
      }
    }

    return baseResult;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Match analysis timed out. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * AI-powered match analysis using OpenAI
 * More expensive but provides intelligent insights
 * @param {string} resumeText - Resume content
 * @param {string} jobDescription - Job description
 * @returns {Promise<Object>} AI-powered match analysis
 */
export const analyzeResumeWithAI = async (resumeText, jobDescription) => {
  const resume = sanitizeText(resumeText);
  const job = sanitizeText(jobDescription);

  if (!resume || !job) {
    throw new Error("Both resume and job description are required for AI analysis.");
  }

  const { controller, timer } = createTimeoutController(OPTIMIZATION_TIMEOUT);

  try {
    const response = await fetch(`${FUNCTION_BASE_PATH}/ai-match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeText: resume,
        jobDescription: job,
      }),
      signal: controller.signal,
    });

    const data = await handleResponse(response);

    return {
      score: clampScore(data.score),
      coverage: clampRatio(data.coverage),
      cosine: clampRatio(data.similarity),
      missingKeywords: data.missingKeywords || [],
      topHits: data.strongMatches || [],
      suggestions: data.recommendations || [],
      overallAssessment: data.overallAssessment || "",
      explanation: data.explanation || { reason: "", tips: [] },
      model: data.model,
      usage: data.usage,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("AI match analysis timed out. Try again shortly.");
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

  const { controller, timer } = createTimeoutController(OPTIMIZATION_TIMEOUT);
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
