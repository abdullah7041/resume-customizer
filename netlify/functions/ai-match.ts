import { Handler } from '@netlify/functions';
import { processMatchOnly } from "../lib/gemini-client.js";
import { withRateLimit } from "../lib/rate-limiter.js";
import { MatchRequestSchema, formatZodError } from "../lib/resume-schemas.js";
import { initSentry, captureError, summarizeErrorForLog } from "../lib/sentry.js";
import { checkCredits, consumeCredits } from "../lib/credit-manager.js";
import { getClientIP } from "../lib/ip-utils.js";
import { getSupabaseClient } from "../lib/supabase-client.js";
import { normalizeScore } from "../lib/score-utils.js";
import { buildStrategicRealityCheckSummary } from "../lib/strategic-reality-check.js";
import { MODELS } from "../lib/model-registry.js";

initSentry();

const baseHandler: Handler = async (event) => {
  // Outer try-catch prevents ANY uncaught exception from escaping the handler
  // (uncaught exceptions cause Netlify to return 502 Bad Gateway)
  try {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let rawBody: Record<string, unknown>;
  try {
    rawBody = JSON.parse(event.body || "{}");
  } catch {
    rawBody = {};
  }
  const freePreview = rawBody.freePreview === true;

  // Extract auth token from header
  const authHeader = event.headers.authorization || event.headers.Authorization;
  const client = getSupabaseClient();
  let user: any = null;
  let userEmail: string | undefined;

  if (!freePreview && !authHeader) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Authentication required. Please sign in." })
    };
  }

  if (authHeader) {
    if (!client) {
      return {
        statusCode: 503,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Service temporarily unavailable" })
      };
    }

    // Verify token and get authenticated user
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user: authUser }, error: authError } = await client.auth.getUser(token);

    if (authError || !authUser) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid or expired authentication token" })
      };
    }
    user = authUser;
    userEmail = authUser.email;
  }

  // Extract IP and email verification for anti-abuse checks
  const ipAddress = getClientIP(event);
  const emailVerified = user?.email_confirmed_at !== null;

  // Check credits BEFORE processing (2 credits for ai_match)
  const creditCheck = freePreview || !userEmail
    ? { hasCredits: true, required: 0, available: 0 }
    : await checkCredits(userEmail, 'ai_match', { ipAddress, emailVerified });

  if (!creditCheck.hasCredits) {
    return {
      statusCode: 403,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Insufficient credits",
        creditsRequired: creditCheck.required,
        creditsAvailable: creditCheck.available,
        creditsNeeded: creditCheck.required - creditCheck.available
      })
    };
  }

  try {
    // Validate request using Zod schema
    const parseResult = MatchRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const validationError = formatZodError(parseResult.error);
      console.error('[ai-match] Validation failed:', validationError);
      console.error('[ai-match] Received payload keys:', Object.keys(rawBody));
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: validationError })
      };
    }

    const { resumeText, jobText, language } = parseResult.data;

    // Use fast match-only function for quick scoring (~10-15 seconds)
    const aiStartTime = Date.now();
    const match = await processMatchOnly(resumeText, jobText, language);
    const latencyMs = Date.now() - aiStartTime;
    const normalizedScore = normalizeScore(match.score, 'match score');

    // Map to frontend expected format
    const response = {
      score: normalizedScore,
      coverage: normalizedScore / 100,
      similarity: normalizedScore / 100,
      missingKeywords: match.missingKeywords,
      strongMatches: match.strongMatches,
      matched_keywords: match.strongMatches,
      recommendations: match.missingKeywords.slice(0, 5).map((k: string) =>
        language === 'ar' ? `أضف "${k}" إلى سيرتك الذاتية` : `Consider adding "${k}" to your resume`
      ),
      overallAssessment: match.reasoning,
      explanation: {
        reason: match.reasoning,
        tips: match.missingKeywords.map((k: string) =>
          language === 'ar' ? `أضف "${k}" إلى سيرتك الذاتية` : `Consider adding "${k}" to your resume`
        )
      },
      categoryScores: match.categoryScores || null,
      strategicRealityCheck: match.strategicRealityCheck || null,
      interviewPrep: null,
      gapAnalysis: [],
      keywordStrategy: null,
      debug: {
        model: MODELS.flash,
        latencyMs,
      },
    };

    // Consume credits AFTER successful match (BEFORE database writes to minimize latency)
    const creditResult = freePreview || !userEmail
      ? { creditsRemaining: null }
      : await consumeCredits(userEmail, 'ai_match');

    // Save privacy-safe summary metadata ASYNCHRONOUSLY (don't await - fire and forget)
    // This prevents database latency from eating into the 90s Netlify timeout.
    if (userEmail && user && client) {
      const realityCheckSummary = buildStrategicRealityCheckSummary({
        userId: user.id,
        matchScore: normalizedScore,
        language,
        resumeText,
        jobText,
        strategicRealityCheck: response.strategicRealityCheck,
      });

      if (realityCheckSummary) {
        Promise.resolve(
          client.from('strategic_reality_checks').insert(realityCheckSummary)
        ).catch((dbError: Error) => {
          console.warn('[ai-match] Reality Check summary insert failed:', summarizeErrorForLog(dbError));
        });
      } else {
        console.warn('[ai-match] Reality Check summary persistence skipped: missing hash secret or invalid summary');
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...response,
        creditsRemaining: creditResult.creditsRemaining,
        freePreview,
      }),
    };

  } catch (error) {
    const errorDetails = error as any;
    console.error("Match error details:", summarizeErrorForLog(error));

    // Don't send timeout errors to Sentry (expected behavior under load)
    if (errorDetails?.name !== 'TimeoutError') {
      let rawBody: Record<string, unknown> = {};
      try {
        rawBody = event.body ? JSON.parse(event.body) : {};
      } catch {
        rawBody = {};
      }
      captureError(error, {
        function: 'ai-match',
        payload: {
          resumeTextLength: typeof rawBody.resumeText === 'string' ? rawBody.resumeText.length : 0,
          jobTextLength: typeof rawBody.jobText === 'string' ? rawBody.jobText.length : 0,
          hasResumeText: Boolean(rawBody.resumeText),
          hasJobText: Boolean(rawBody.jobText),
          language: rawBody.language || null,
        },
      });
    }

    // Return 504 for timeout errors, 500 for other errors
    const isTimeout = errorDetails?.name === 'TimeoutError' || errorDetails?.status === 504;

    return {
      statusCode: isTimeout ? 504 : 500,
      headers: {
        "Content-Type": "application/json",
        ...(isTimeout && {
          'Retry-After': '30',
          'X-Timeout-Location': 'openrouter-api'
        })
      },
      body: JSON.stringify({
        error: isTimeout
          ? 'Analysis timed out due to high AI service load. This is automatically retried - please wait.'
          : "Failed to analyze match. Please try again.",
        retryable: isTimeout,
        troubleshooting: isTimeout
          ? 'The AI service (OpenRouter) is experiencing delays. Automatic retries are in progress.'
          : 'Check your network connection and authentication status. If the issue persists, contact support.'
      }),
    };
  }

  } catch (outerError) {
    // This catches ANY uncaught error (e.g., from checkCredits, getClientIP, getSupabaseClient)
    // Without this, the error escapes the handler and Netlify returns 502
    console.error('[ai-match] Uncaught handler error:', summarizeErrorForLog(outerError));
    captureError(outerError, { function: 'ai-match', phase: 'outer-catch' });
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "An unexpected error occurred. Please try again.",
      }),
    };
  }
};

// Export handler with rate limiting applied
export const handler = withRateLimit("ai-match", baseHandler);
