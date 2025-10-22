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

// JSON schema for structured resume extraction
const RESUME_JSON_SCHEMA = {
  name: "resume_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Full name of the candidate" },
      email: { type: "string", description: "Email address" },
      phone: { type: "string", description: "Phone number" },
      location: { type: "string", description: "City, State or Country" },
      summary: { type: "string", description: "Professional summary or objective" },
      skills: {
        type: "array",
        items: { type: "string" },
        description: "List of technical and professional skills"
      },
      experience: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Job title" },
            company: { type: "string", description: "Company name" },
            location: { type: "string", description: "Job location" },
            startDate: { type: "string", description: "Start date (e.g., Jan 2020)" },
            endDate: { type: "string", description: "End date or 'Present'" },
            duration: { type: "string", description: "Duration (e.g., 2 years)" },
            responsibilities: {
              type: "array",
              items: { type: "string" },
              description: "Key responsibilities and achievements"
            }
          },
          required: ["title", "company", "startDate", "responsibilities"],
          additionalProperties: false
        },
        description: "Work experience history"
      },
      education: {
        type: "array",
        items: {
          type: "object",
          properties: {
            degree: { type: "string", description: "Degree or certification" },
            institution: { type: "string", description: "School or university name" },
            location: { type: "string", description: "Location of institution" },
            graduationDate: { type: "string", description: "Graduation date" },
            gpa: { type: "string", description: "GPA if available" },
            honors: { type: "string", description: "Awards or honors" }
          },
          required: ["degree", "institution"],
          additionalProperties: false
        },
        description: "Educational background"
      },
      certifications: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Certification name" },
            issuer: { type: "string", description: "Issuing organization" },
            date: { type: "string", description: "Date obtained" },
            expiryDate: { type: "string", description: "Expiry date if applicable" }
          },
          required: ["name", "issuer"],
          additionalProperties: false
        },
        description: "Professional certifications"
      },
      languages: {
        type: "array",
        items: {
          type: "object",
          properties: {
            language: { type: "string", description: "Language name" },
            proficiency: { type: "string", description: "Proficiency level (e.g., Native, Fluent, Professional)" }
          },
          required: ["language", "proficiency"],
          additionalProperties: false
        },
        description: "Language skills"
      },
      projects: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Project name" },
            description: { type: "string", description: "Brief project description" },
            technologies: {
              type: "array",
              items: { type: "string" },
              description: "Technologies used"
            },
            url: { type: "string", description: "Project URL if available" }
          },
          required: ["name", "description"],
          additionalProperties: false
        },
        description: "Notable projects"
      },
      awards: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Award name" },
            issuer: { type: "string", description: "Awarding organization" },
            date: { type: "string", description: "Date received" },
            description: { type: "string", description: "Award details" }
          },
          required: ["title", "issuer"],
          additionalProperties: false
        },
        description: "Awards and honors"
      }
    },
    required: ["name", "skills", "experience"],
    additionalProperties: false
  }
};

const EXTRACTION_PROMPT = `You are a resume parser that extracts structured information from resume text.

CRITICAL RULES:
1. Extract ONLY information explicitly stated in the resume
2. DO NOT invent, assume, or fabricate any information
3. If a field is not present in the resume, omit it from the JSON
4. Use exact text from resume where possible
5. Preserve original formatting of dates and numbers
6. Return ONLY valid JSON - no markdown, no commentary, no explanations

Parse the following resume and return structured JSON:`;

const sanitize = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

export const handler: Handler = async (event, _context) => {
  const requestId = event.headers?.["x-nf-request-id"] ?? crypto.randomUUID?.() ?? `${Date.now()}`;

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: HEADERS,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(`[${requestId}] Missing OPENAI_API_KEY`);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: "OpenAI API key not configured" })
    };
  }

  const startTime = performance.now();

  try {
    const body = JSON.parse(event.body || "{}");
    const resumeText = sanitize(body.resumeText);

    if (!resumeText) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ error: "resumeText is required" })
      };
    }

    console.log(`[${requestId}] Extracting structured JSON from resume (${resumeText.length} chars)`);

    // Build OpenAI request with structured output
    const openAIConfig = resolveOpenAIOptions();
    const openAIRequest = {
      model: openAIConfig.model,
      temperature: openAIConfig.temperature,
      max_tokens: 3000, // Need more tokens for structured output
      response_format: {
        type: "json_schema",
        json_schema: RESUME_JSON_SCHEMA
      },
      messages: [
        {
          role: "system",
          content: EXTRACTION_PROMPT
        },
        {
          role: "user",
          content: resumeText
        }
      ]
    };

    console.log(`[${requestId}] Calling OpenAI with structured output mode`);

    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(openAIRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${requestId}] OpenAI API error:`, errorText);
      return {
        statusCode: response.status,
        headers: HEADERS,
        body: JSON.stringify({
          error: "OpenAI API request failed",
          details: errorText
        })
      };
    }

    const data = await response.json();
    const content = (data as any).choices?.[0]?.message?.content;

    if (!content) {
      console.error(`[${requestId}] No content in OpenAI response`);
      return {
        statusCode: 500,
        headers: HEADERS,
        body: JSON.stringify({ error: "No content returned from OpenAI" })
      };
    }

    // Parse and validate JSON
    let parsedData;
    try {
      parsedData = JSON.parse(content);
    } catch (parseError) {
      console.error(`[${requestId}] Failed to parse JSON response:`, parseError);
      return {
        statusCode: 500,
        headers: HEADERS,
        body: JSON.stringify({
          error: "Invalid JSON returned from AI",
          rawContent: content
        })
      };
    }

    const duration = performance.now() - startTime;
    console.log(`[${requestId}] Successfully extracted structured resume data in ${duration.toFixed(0)}ms`);

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        data: parsedData,
        model: (data as any).model,
        usage: (data as any).usage,
        duration: Math.round(duration)
      })
    };

  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`[${requestId}] Error after ${duration.toFixed(0)}ms:`, error);

    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred"
      })
    };
  }
};
