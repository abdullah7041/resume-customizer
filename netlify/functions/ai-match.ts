import { Handler } from '@netlify/functions';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { processMatchOnly } from "../lib/gemini-client";
import { withRateLimit } from "../lib/rate-limiter";
import { MatchRequestSchema, formatZodError } from "../lib/resume-schemas";
import { initSentry, captureError } from "../lib/sentry";
import { checkCredits, consumeCredits } from "../lib/credit-manager";
import { getClientIP } from "../lib/ip-utils.js";

initSentry();

// Lazy-initialized Supabase client (avoids module-level errors when env vars are missing)
let supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (supabase) return supabase;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('[ai-match] Supabase credentials not configured - database features disabled');
    return null;
  }

  supabase = createClient(url, key);
  return supabase;
}

const baseHandler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Extract auth token from header
  const authHeader = event.headers.authorization || event.headers.Authorization;

  if (!authHeader) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Authentication required. Please sign in." })
    };
  }

  // Verify token and get authenticated user
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const client = getSupabaseClient();

  if (!client) {
    return {
      statusCode: 503,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Service temporarily unavailable" })
    };
  }

  const { data: { user }, error: authError } = await client.auth.getUser(token);

  if (authError || !user) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid or expired authentication token" })
    };
  }

  const userId = user.id;

  // Extract IP and email verification for anti-abuse checks
  const ipAddress = getClientIP(event);
  const emailVerified = user.email_confirmed_at !== null || user.email_verified !== false;

  // Check credits BEFORE processing (2 credits for ai_match)
  const creditCheck = await checkCredits(userId, 'ai_match', { ipAddress, emailVerified });

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
    const rawBody = JSON.parse(event.body || "{}");

    // Validate request using Zod schema
    const parseResult = MatchRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: formatZodError(parseResult.error) })
      };
    }

    const { resumeText, jobDesc } = parseResult.data;

    // Use fast match-only function for quick scoring (~10-15 seconds)
    const match = await processMatchOnly(resumeText, jobDesc);

    // Save to database if user is authenticated and Supabase is configured
    if (userId && client) {
      try {
        await client.from('job_matches').insert({
          user_id: userId,
          resume_text: resumeText.substring(0, 5000), // Truncate for storage
          job_text: jobDesc.substring(0, 5000), // Truncate for storage
          score: match.score,
          missing_keywords: match.missingKeywords,
          suggestions: match.strongMatches,
        });
      } catch {
        // Non-blocking DB error - continue with response
      }
    }

    // Map to frontend expected format
    const response = {
      score: match.score,
      coverage: match.score / 100,
      similarity: match.score / 100,
      missingKeywords: match.missingKeywords,
      strongMatches: match.strongMatches,
      matched_keywords: match.strongMatches,
      recommendations: match.missingKeywords.slice(0, 5),
      overallAssessment: match.reasoning,
      explanation: {
        reason: match.reasoning,
        tips: match.missingKeywords.map((k: string) => `Consider adding ${k}`)
      },
      categoryScores: match.categoryScores || null,
      interviewPrep: null,
      gapAnalysis: [],
      keywordStrategy: null
    };

    // Consume credits AFTER successful match
    const creditResult = await consumeCredits(userId, 'ai_match');

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...response,
        creditsRemaining: creditResult.creditsRemaining,
      }),
    };

  } catch (error) {
    const errorDetails = error as any;
    console.error("Match error details:", {
      message: errorDetails?.message || 'Unknown error',
      stack: errorDetails?.stack || 'No stack trace',
      name: errorDetails?.name || 'Error',
      code: errorDetails?.code || '',
    });

    captureError(error, {
      function: 'ai-match',
      payload: JSON.parse(event.body || '{}'),
      userId,
    });

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Failed to analyze match",
        message: errorDetails?.message || 'Unknown error occurred',
      }),
    };
  }
};

// Export handler with rate limiting applied
export const handler = withRateLimit("ai-match", baseHandler);
