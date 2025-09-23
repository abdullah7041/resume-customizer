import type { Handler } from "@netlify/functions";

type OptimizeBody = {
  resumeText?: string;
  jobDesc?: string;
  mode?: "auto" | "conservative" | "aggressive";
  preview?: boolean;
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

const callOpenAI = async (payload: OptimizeBody, apiKey: string): Promise<OptimizationPayload> => {
  const { resumeText = "", jobDesc = "", mode = "auto" } = payload;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: `You are an assistant helping optimize resumes for Saudi Arabia job descriptions. Return strict JSON with keys cards (array) and keywords (object). Each card must include section, issue, suggestion, exampleBefore, exampleAfter. Mode is ${mode}. Resume: ${resumeText.slice(0, 4000)} Job: ${jobDesc.slice(0, 4000)}`,
      response_format: { type: "json_object" },
      max_output_tokens: 900,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const message = typeof data?.error?.message === "string" ? data.error.message : "OpenAI request failed";
    throw new Error(message);
  }

  const raw = typeof data.output_text === "string"
    ? data.output_text
    : data.choices?.[0]?.message?.content;

  if (typeof raw !== "string") {
    return buildMockCards(resumeText, jobDesc, mode);
  }

  try {
    const parsed = JSON.parse(raw);
    const payloadResult = toPayload(parsed);
    return { ...payloadResult, source: "openai" };
  } catch {
    return buildMockCards(resumeText, jobDesc, mode);
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

export { handler };
