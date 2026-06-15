import { Handler } from '@netlify/functions';
import { analyzeResumeTruthCheck } from "../lib/gemini-client.js";
import { withRateLimit } from "../lib/rate-limiter.js";
import { TruthCheckRequestSchema, formatZodError } from "../lib/resume-schemas.js";
import { initSentry, captureError, summarizeErrorForLog } from "../lib/sentry.js";
import { getSupabaseClient } from "../lib/supabase-client.js";
import { MODELS } from "../lib/model-registry.js";

initSentry();

const headers = { "Content-Type": "application/json" };

const baseHandler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "Authentication required. Please sign in." }),
    };
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const client = getSupabaseClient();
  if (!client) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: "Service temporarily unavailable" }),
    };
  }

  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "Invalid or expired authentication token" }),
    };
  }

  let rawBody: unknown;
  try {
    rawBody = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const parseResult = TruthCheckRequestSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: formatZodError(parseResult.error) }),
    };
  }

  const { resumeText, language } = parseResult.data;
  const startTime = Date.now();

  try {
    const result = await analyzeResumeTruthCheck(resumeText, language);
    const latencyMs = Date.now() - startTime;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...result,
        debug: {
          ...(result.debug && typeof result.debug === "object" ? result.debug : {}),
          model: MODELS.flash,
          latencyMs,
        },
      }),
    };
  } catch (error) {
    console.error("[resume-truth-check] Error:", summarizeErrorForLog(error));

    const errorDetails = error as { name?: string; status?: number };
    const isTimeout = errorDetails?.name === "TimeoutError" || errorDetails?.status === 504;

    if (!isTimeout) {
      captureError(error, {
        function: "resume-truth-check",
        userId: user.id,
        payload: {
          resumeTextLength: resumeText.length,
          language,
        },
      });
    }

    return {
      statusCode: isTimeout ? 504 : 500,
      headers: {
        ...headers,
        ...(isTimeout ? {
          "Retry-After": "30",
          "X-Timeout-Location": "openrouter-api",
        } : {}),
      },
      body: JSON.stringify({
        error: isTimeout
          ? "Truth Check timed out due to high AI service load. Please wait and try again."
          : "Failed to run Resume Truth Check. Please try again.",
        retryable: isTimeout,
      }),
    };
  }
};

export const handler = withRateLimit("resume-truth-check", baseHandler);
