import { Handler } from '@netlify/functions';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { processMatchOnly } from "../lib/gemini-client";
import { withRateLimit } from "../lib/rate-limiter";
import { MatchRequestSchema, formatZodError } from "../lib/resume-schemas";
import { initSentry, captureError } from "../lib/sentry";

initSentry();

// Lazy-initialized Supabase client (avoids module-level errors when env vars are missing)
let supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (supabase) return supabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

    // Extract user ID from Authorization header (optional)
    let userId: string | null = null;
    const client = getSupabaseClient();

    if (client) {
      try {
        const authHeader = event.headers.authorization || event.headers.Authorization;
        if (authHeader?.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const { data: { user } } = await client.auth.getUser(token);
          userId = user?.id || null;
        }
      } catch {
        // Non-blocking auth error
      }
    }

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

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error("Match error details:", error);
    captureError(error, {
      function: 'ai-match',
      payload: JSON.parse(event.body || '{}'),
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to analyze match" }),
    };
  }
};

// Export handler with rate limiting applied
export const handler = withRateLimit("ai-match", baseHandler);
