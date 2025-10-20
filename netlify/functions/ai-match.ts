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

const AI_MATCH_PROMPT = `You are an expert ATS (Applicant Tracking System) and HR recruiter analyzer. Analyze how well a resume matches a job description.

CRITICAL RULES:
1. Provide an honest, realistic match score (0-100) - DO NOT give inflated scores
2. Identify specific missing keywords and skills from the job description
3. Highlight strong alignment areas where resume matches job requirements
4. Provide actionable, specific recommendations
5. Include detailed explanation with reasoning and tips
6. Return ONLY valid JSON with no markdown code fences or extra text

Output format (MUST be valid JSON):
{
  "score": 75,
  "coverage": 0.68,
  "similarity": 0.72,
  "missingKeywords": ["Python", "AWS", "Docker", "Kubernetes"],
  "strongMatches": ["JavaScript", "React", "Node.js", "TypeScript"],
  "recommendations": [
    "Add specific cloud platform experience (AWS/Azure)",
    "Highlight any Python or backend development projects",
    "Include containerization experience if available"
  ],
  "overallAssessment": "Strong frontend skills but needs backend/DevOps experience",
  "explanation": {
    "reason": "Your resume shows strong frontend development skills but the job requires full-stack capabilities including cloud infrastructure.",
    "tips": [
      "Emphasize any backend or cloud experience you have",
      "Add metrics to demonstrate impact (e.g., '30% performance improvement')",
      "Include relevant certifications if you have them"
    ]
  }
}

RESUME:`;

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
    const resumeText = sanitize(body?.resumeText ?? body?.resume ?? "");
    const jobDescription = sanitize(body?.jobDescription ?? body?.job ?? "");

    if (!resumeText || !jobDescription) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ error: "Both resume and job description are required" }),
      };
    }

    const apiKey = process.env.OPENAI_API_KEY ?? process.env.VITE_OPENAI_KEY;
    if (!apiKey) {
      console.error("[ai-match] missing OPENAI_API_KEY", { requestId });
      return {
        statusCode: 503,
        headers: HEADERS,
        body: JSON.stringify({ error: "OpenAI is not configured." }),
      };
    }

    const fullPrompt = `${AI_MATCH_PROMPT}\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}`;

    const options = resolveOpenAIOptions({
      model: body?.model,
      max_completion_tokens: 1500,
    });

    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        temperature: options.temperature,
        max_completion_tokens: options.max_completion_tokens,
        messages: [
          {
            role: "system",
            content: "You are an expert ATS analyzer who provides realistic, actionable resume-job matching insights.",
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
      console.error("[ai-match] request failed", {
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
    let matchResult = null;
    
    try {
      // Remove markdown code fences if present
      const cleaned = outputText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      matchResult = JSON.parse(cleaned);
    } catch {
      console.error("[ai-match] JSON parse error", { requestId, outputText });
      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({
          score: 0,
          coverage: 0,
          similarity: 0,
          missingKeywords: [],
          strongMatches: [],
          recommendations: [],
          overallAssessment: "Failed to parse AI response",
          rawOutput: outputText,
          error: "JSON parse failed"
        }),
      };
    }

    const latency = Math.round(performance.now() - start);
    console.info("[ai-match] request complete", {
      requestId,
      model: options.model,
      score: matchResult.score,
      latency_ms: latency,
    });

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        ...matchResult,
        model: data?.model ?? options.model,
        usage: data?.usage ?? null,
      }),
    };
  } catch (error) {
    const latency = Math.round(performance.now() - start);
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[ai-match] request error", { requestId, message, latency_ms: latency });
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: message }),
    };
  }
};

export { handler };
