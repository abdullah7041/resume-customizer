import { Handler } from '@netlify/functions';
import { generateCoverLetter } from "../lib/gemini-client";
import { withRateLimit } from "../lib/rate-limiter";
import { CoverLetterRequestSchema, formatZodError } from "../lib/resume-schemas";
import { initSentry, captureError } from "../lib/sentry";
import { checkCredits, consumeCredits } from "../lib/credit-manager";
import { getSupabaseClient } from "../lib/supabase-client";
import { getClientIP } from "../lib/ip-utils.js";

initSentry();

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
  const supabase = getSupabaseClient();

  if (!supabase) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Server configuration error. Please contact support."
      })
    };
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid or expired authentication token" })
    };
  }

  const userEmail = user.email;

  // Extract IP and email verification for anti-abuse checks
  const ipAddress = getClientIP(event);
  const emailVerified = user.email_confirmed_at !== null || (user as any).email_verified !== false;

  // Check credits BEFORE processing (4 credits for cover_letter)
  const creditCheck = await checkCredits(userEmail, 'cover_letter', { ipAddress, emailVerified });

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
    const parseResult = CoverLetterRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: formatZodError(parseResult.error) })
      };
    }

    const { resumeText, jobDescription, language } = parseResult.data;

    const result = await generateCoverLetter(resumeText, jobDescription, language);

    // Consume credits AFTER successful generation
    const creditResult = await consumeCredits(userEmail, 'cover_letter');

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coverLetter: result.draft_text,
        creditsRemaining: creditResult.creditsRemaining,
      }),
    };

  } catch (error) {
    console.error("Cover letter error:", error);
    captureError(error, {
      function: 'generate-cover-letter',
      payload: JSON.parse(event.body || '{}'),
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to generate cover letter" }),
    };
  }
};

// Export handler with rate limiting applied
export const handler = withRateLimit("generate-cover-letter", baseHandler);
