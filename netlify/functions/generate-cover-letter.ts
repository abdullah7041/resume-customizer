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

const COVER_LETTER_SYSTEM_PROMPT = `You are an expert career coach and professional writer specializing in cover letters. Generate a compelling, tailored cover letter based on the candidate's resume and the job description.

CRITICAL RULES:
1. ONLY use information explicitly stated in the resume - DO NOT invent experiences or qualifications
2. Write in a professional, confident tone that matches the industry
3. Follow proper cover letter structure: opening, body (2-3 paragraphs), closing
4. Highlight relevant achievements from the resume that align with job requirements
5. Keep it concise: 3-4 paragraphs, approximately 250-350 words
6. Use specific examples and quantifiable achievements when available
7. Return ONLY valid JSON with no markdown, explanations, or extra text

Output format:
{
  "coverLetter": "The complete cover letter text",
  "sections": {
    "opening": "First paragraph text",
    "body": "Middle paragraphs text", 
    "closing": "Final paragraph text"
  },
  "tone": "professional|enthusiastic|formal|creative",
  "wordCount": 123,
  "keyHighlights": ["highlight1", "highlight2", "highlight3"]
}`;

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
    const resumeText = sanitize(body?.resumeText ?? body?.resume);
    const jobDescription = sanitize(body?.jobDescription ?? body?.jobDesc ?? body?.job);
    const companyName = sanitize(body?.companyName ?? "");
    const hiringManager = sanitize(body?.hiringManager ?? "");
    const tone = sanitize(body?.tone ?? "professional");

    if (!resumeText || !jobDescription) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ error: "Both resume and job description are required" }),
      };
    }

    const apiKey = process.env.OPENAI_API_KEY ?? process.env.VITE_OPENAI_KEY;
    if (!apiKey) {
      console.error("[generate-cover-letter] missing OPENAI_API_KEY", { requestId });
      return {
        statusCode: 503,
        headers: HEADERS,
        body: JSON.stringify({ error: "OpenAI is not configured." }),
      };
    }

    // Build the user prompt
    let userPrompt = `Generate a tailored cover letter for this job application.\n\n`;
    userPrompt += `RESUME:\n${resumeText}\n\n`;
    userPrompt += `JOB DESCRIPTION:\n${jobDescription}\n\n`;
    
    if (companyName) {
      userPrompt += `COMPANY NAME: ${companyName}\n`;
    }
    if (hiringManager) {
      userPrompt += `HIRING MANAGER: ${hiringManager}\n`;
    }
    userPrompt += `DESIRED TONE: ${tone}\n\n`;
    userPrompt += `Generate the cover letter now.`;

    const options = resolveOpenAIOptions({
      model: body?.model,
      temperature: 1, // gpt-5-nano requires temperature=1
      max_output_tokens: 1500,
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
            content: COVER_LETTER_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = typeof data?.error?.message === "string" ? data.error.message : "OpenAI request failed";
      console.error("[generate-cover-letter] request failed", {
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
    let coverLetter = "";
    let sections = { opening: "", body: "", closing: "" };
    let resultTone = tone;
    let wordCount = 0;
    let keyHighlights = [];
    
    try {
      // Remove markdown code fences if present
      const cleaned = outputText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      
      coverLetter = parsed.coverLetter || "";
      sections = parsed.sections || sections;
      resultTone = parsed.tone || tone;
      wordCount = parsed.wordCount || coverLetter.split(/\s+/).length;
      keyHighlights = parsed.keyHighlights || [];
    } catch {
      console.warn("[generate-cover-letter] JSON parse error, using raw output", { requestId });
      // Fallback: use raw text as cover letter
      coverLetter = outputText;
      wordCount = outputText.split(/\s+/).length;
    }

    const latency = Math.round(performance.now() - start);
    console.info("[generate-cover-letter] request complete", {
      requestId,
      model: options.model,
      wordCount,
      latency_ms: latency,
    });

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        coverLetter,
        sections,
        tone: resultTone,
        wordCount,
        keyHighlights,
        model: data?.model ?? options.model,
        usage: data?.usage ?? null,
      }),
    };
  } catch (error) {
    const latency = Math.round(performance.now() - start);
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[generate-cover-letter] request error", { requestId, message, latency_ms: latency });
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: message }),
    };
  }
};

export { handler };
