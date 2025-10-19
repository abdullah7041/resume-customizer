import type { Handler } from "@netlify/functions";
import { performance } from "node:perf_hooks";
import { resolveOpenAIOptions } from "../lib/ai-config";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
} as const;

const getRequestId = (event: Parameters<Handler>[0]) =>
  event.headers?.["x-nf-request-id"] ?? crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

const QUESTION_PREDICTION_PROMPT = `You are an expert HR interviewer and career coach. Based on the job description provided, predict 12-15 likely interview questions that a candidate might face.

CRITICAL RULES:
1. Generate realistic, specific questions based on the job requirements
2. Include a mix of technical, behavioral, and situational questions
3. Ensure questions are relevant to the role level (entry, mid, senior)
4. Return ONLY valid JSON with no markdown, explanations, or extra text

Output format:
{
  "questions": [
    {
      "question": "The interview question text",
      "type": "technical|behavioral|situational|case-study",
      "difficulty": "easy|medium|hard",
      "category": "skills|experience|culture-fit|problem-solving",
      "answerFramework": "Brief guidance on how to structure the answer (2-3 sentences)"
    }
  ],
  "roleLevel": "entry|mid|senior|executive",
  "focusAreas": ["area1", "area2", "area3"]
}

JOB DESCRIPTION:`;

const sanitize = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
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

  const requestId = getRequestId(event);
  const start = performance.now();

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const jobDescription = sanitize(body?.jobDescription ?? body?.jobDesc ?? body?.job);
    const resumeText = sanitize(body?.resumeText ?? body?.resume ?? "");

    if (!jobDescription) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ error: "Job description is required" }),
      };
    }

    const apiKey = process.env.OPENAI_API_KEY ?? process.env.VITE_OPENAI_KEY;
    if (!apiKey) {
      console.error("[predict-questions] missing OPENAI_API_KEY", { requestId });
      return {
        statusCode: 503,
        headers: HEADERS,
        body: JSON.stringify({ error: "OpenAI is not configured." }),
      };
    }

    // Build context-aware prompt
    let fullPrompt = QUESTION_PREDICTION_PROMPT + "\n" + jobDescription;
    
    if (resumeText) {
      fullPrompt += "\n\nCANDIDATE RESUME CONTEXT (use to personalize questions):\n" + resumeText.substring(0, 1500);
    }

    const options = resolveOpenAIOptions({
      model: body?.model,
      temperature: 1, // gpt-5-nano requires temperature=1
      max_output_tokens: 2048,
    });

    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        ...options,
        messages: [
          {
            role: "system",
            content: "You are an expert HR interviewer and career coach who predicts realistic interview questions.",
          },
          {
            role: "user",
            content: fullPrompt,
          },
        ],
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = typeof data?.error?.message === "string" ? data.error.message : "OpenAI request failed";
      console.error("[predict-questions] request failed", {
        requestId,
        status: response.status,
        message,
      });
      return {
        statusCode: response.status,
        headers: HEADERS,
        body: JSON.stringify({ error: message }),
      };
    }

    const outputText = data?.choices?.[0]?.message?.content ?? "";
    
    // Parse JSON response
    let questions = [];
    let roleLevel = "mid";
    let focusAreas = [];
    
    try {
      // Remove markdown code fences if present
      const cleaned = outputText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      
      questions = parsed.questions || [];
      roleLevel = parsed.roleLevel || "mid";
      focusAreas = parsed.focusAreas || [];
    } catch {
      console.error("[predict-questions] JSON parse error", { requestId, outputText });
      // Fallback: return raw text
      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({
          questions: [],
          roleLevel: "mid",
          focusAreas: [],
          rawOutput: outputText,
          error: "Failed to parse AI response"
        }),
      };
    }

    const latency = Math.round(performance.now() - start);
    console.info("[predict-questions] request complete", {
      requestId,
      model: options.model,
      questionCount: questions.length,
      latency_ms: latency,
    });

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        questions,
        roleLevel,
        focusAreas,
        model: data?.model ?? options.model,
        usage: data?.usage ?? null,
      }),
    };
  } catch (error) {
    const latency = Math.round(performance.now() - start);
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[predict-questions] request error", { requestId, message, latency_ms: latency });
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: message }),
    };
  }
};

export { handler };
