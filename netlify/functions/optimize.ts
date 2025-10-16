import type { Handler } from "@netlify/functions";
import { resolveOpenAIOptions } from "../lib/ai-config";

type OptimizeBody = {
  resumeText?: string;
  jobDesc?: string;
  mode?: "auto" | "conservative" | "aggressive";
  preview?: boolean;
  model?: string;
  temperature?: number;
  max_output_tokens?: number;
  max_completion_tokens?: number;
};

type OptimizationCard = {
  section: string;
  issue: string;
  suggestion: string;
  exampleBefore: string;
  exampleAfter: string;
};

type OptimizationPayload = {
  cards: OptimizationCard[];
  keywords: {
    add: string[];
    remove: string[];
    neutral: string[];
  };
  source: "mock" | "openai";
};

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
} as const;

const REQUEST_TIMEOUT = 25_000; // Increased from 15s to 25s

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

const sanitize = (value: string): string => {
  let buffer = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    buffer += code < 32 || code === 127 ? " " : char;
  }
  return buffer.trim();
};

const tokenize = (input: string): string[] =>
  input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9]+/g)
    ?.filter((token) => !STOPWORDS.has(token) && token.length > 2) ?? [];

const pickKeywords = (jobDesc: string, resumeText: string) => {
  const jobTokens = tokenize(jobDesc);
  const resumeTokens = new Set(tokenize(resumeText));
  const counts = new Map<string, number>();
  for (const token of jobTokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const add: string[] = [];
  const neutral: string[] = [];
  for (const [token] of ranked) {
    if (add.length < 6 && !resumeTokens.has(token)) {
      add.push(token);
    } else if (neutral.length < 6 && resumeTokens.has(token)) {
      neutral.push(token);
    }
    if (add.length >= 6 && neutral.length >= 6) break;
  }
  return {
    add,
    neutral,
    remove: [] as string[],
  };
};

const buildMockCards = (resumeText: string, jobDesc: string, mode: OptimizeBody["mode"]): OptimizationPayload => {
  const keywords = pickKeywords(jobDesc, resumeText);
  const toneMap: Record<string, string> = {
    auto: "balanced",
    conservative: "measured",
    aggressive: "impactful",
  };
  const tone = toneMap[mode ?? "auto"] ?? "balanced";
  const baseSections = ["Summary", "Experience", "Skills", "Achievements", "Leadership"];
  const cards: OptimizationCard[] = baseSections.slice(0, 4).map((section, index) => {
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
    keywords: {
      add: keywords.add,
      remove: [],
      neutral: keywords.neutral,
    },
    source: "mock",
  };
};

const toPayload = (value: unknown): OptimizationPayload => {
  const fallback = buildMockCards("", "", "auto");
  if (!value || typeof value !== "object") return fallback;
  const maybe = value as Partial<OptimizationPayload>;
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

const buildPrompt = (resumeText: string, jobDesc: string, mode: OptimizeBody["mode"] = "auto") =>
  `You rewrite resumes for the Saudi market using ATS-safe language. Return ONLY JSON with keys cards (array) and keywords (object). ` +
  `cards[].section, cards[].issue, cards[].suggestion, cards[].exampleBefore, cards[].exampleAfter must all be non-empty strings. ` +
  `keywords must include add, remove, neutral arrays. Keep bullets concise, metric-driven, and culturally neutral.` +
  `\n\nMODE: ${mode}\n\nRESUME:\n${resumeText.slice(0, 4000)}\n\nJOB DESCRIPTION:\n${jobDesc.slice(0, 4000)}`;

const safeJson = (value: string) => {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const segment = value.slice(start, end + 1);
    try {
      return JSON.parse(segment);
    } catch {
      throw new Error("Model did not return valid JSON");
    }
  }
  throw new Error("Model did not return valid JSON");
};

const extractText = (data: any): string => {
  if (!data) return "";
  if (typeof data.output_text === "string") return data.output_text;
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      const text = (item?.content && Array.isArray(item.content) ? item.content[0]?.text : undefined) ?? item?.text;
      if (typeof text === "string" && text.trim().length > 0) {
        return text;
      }
    }
  }
  if (Array.isArray(data.choices)) {
    const text = data.choices[0]?.message?.content;
    if (typeof text === "string") return text;
  }
  return "";
};

const postToOpenAI = async (body: Record<string, unknown>, apiKey: string, timeout = REQUEST_TIMEOUT) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await response.json();
    if (!response.ok) {
      const message = typeof data?.error?.message === "string" ? data.error.message : "OpenAI request failed";
      const error = new Error(message);
      (error as any).status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      const timeoutError = new Error("OpenAI request timed out after " + (timeout / 1000) + "s");
      (timeoutError as any).code = "TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const callOpenAI = async (payload: OptimizeBody, apiKey: string): Promise<OptimizationPayload> => {
  const {
    resumeText = "",
    jobDesc = "",
    mode = "auto",
    model: modelOverride,
    temperature: temperatureOverride,
    max_output_tokens: maxOutputTokens,
    max_completion_tokens: maxCompletionTokens,
  } = payload;
  const prompt = buildPrompt(resumeText, jobDesc, mode);
  const requestOptions = resolveOpenAIOptions(
    {
      model: modelOverride,
      temperature: temperatureOverride,
      max_output_tokens: maxOutputTokens,
      max_completion_tokens: maxCompletionTokens,
    },
    800, // Reduced from 900 to 800 tokens for faster response
  );
  const messages = [
    {
      role: "system",
      content: [
        {
          type: "text",
          text: "You are a resume optimization assistant. Output strictly valid JSON conforming to the provided schema.",
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: prompt,
        },
      ],
    },
  ];

  const schema = {
    type: "object",
    properties: {
      cards: {
        type: "array",
        items: {
          type: "object",
          properties: {
            section: { type: "string" },
            issue: { type: "string" },
            suggestion: { type: "string" },
            exampleBefore: { type: "string" },
            exampleAfter: { type: "string" },
          },
          required: ["section", "issue", "suggestion", "exampleBefore", "exampleAfter"],
        },
        minItems: 1,
        maxItems: 6,
      },
      keywords: {
        type: "object",
        properties: {
          add: { type: "array", items: { type: "string" } },
          remove: { type: "array", items: { type: "string" } },
          neutral: { type: "array", items: { type: "string" } },
        },
        required: ["add", "remove", "neutral"],
      },
    },
    required: ["cards", "keywords"],
    additionalProperties: false,
  };

  const basePayload = {
    ...requestOptions,
    input: messages,
  } as const;

  try {
    const primary = await postToOpenAI(
      {
        ...basePayload,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "OptimizationPayload",
            schema,
          },
        },
      },
      apiKey,
      REQUEST_TIMEOUT, // Use the configured timeout
    );

    const text = extractText(primary);
    const parsed = safeJson(text);
    const payloadResult = toPayload(parsed);
    return { ...payloadResult, source: "openai" };
  } catch (primaryError) {
    // If timeout or 5xx error, use fallback immediately
    const shouldUseFallback = 
      (primaryError as any)?.code === "TIMEOUT" || 
      ((primaryError as any)?.status >= 500);
    
    if (shouldUseFallback) {
      console.warn("[optimize] Primary request failed, using mock data:", 
        (primaryError as Error).message);
      return buildMockCards(resumeText, jobDesc, mode);
    }
    
    // For other errors, try text fallback
    try {
      const fallback = await postToOpenAI(
        {
          ...basePayload,
          response_format: { type: "text" },
        },
        apiKey,
        REQUEST_TIMEOUT,
      );

      const raw = extractText(fallback);
      const parsed = safeJson(raw);
      const payloadResult = toPayload(parsed);
      return { ...payloadResult, source: "openai" };
    } catch (fallbackError) {
      console.warn("[optimize] All attempts failed, using mock data");
      return buildMockCards(resumeText, jobDesc, mode);
    }
  }
};

const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const body: OptimizeBody = event.body ? JSON.parse(event.body) : {};
    const { resumeText, jobDesc, mode = "auto" } = body;

    if (!resumeText || !resumeText.trim() || !jobDesc || !jobDesc.trim()) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ error: "Resume text and job description are required" }),
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;

    const payload = apiKey
      ? await callOpenAI(body, apiKey)
      : buildMockCards(resumeText, jobDesc, mode);

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify(payload),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to optimize resume";
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: message }),
    };
  }
};

export { handler }