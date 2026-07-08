import { Handler } from '@netlify/functions';
import { predictInterviewQuestions } from "../lib/gemini-client.js";
import { withRateLimit } from "../lib/rate-limiter.js";
import { PredictQuestionsRequestSchema, formatZodError } from "../lib/resume-schemas.js";
import { initSentry, captureError, summarizeErrorForLog } from "../lib/sentry.js";
import { checkCredits, consumeCredits, isEmailVerified } from "../lib/credit-manager.js";
import { getSupabaseClient } from "../lib/supabase-client.js";
import { getClientIP } from "../lib/ip-utils.js";
import { detectVulnerabilities } from "../lib/vulnerability-detector.js";

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
  const emailVerified = isEmailVerified(user);

  // Check credits BEFORE processing (3 credits for interview_prep)
  const creditCheck = await checkCredits(userEmail, 'interview_prep', { ipAddress, emailVerified });

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
    const parseResult = PredictQuestionsRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: formatZodError(parseResult.error) })
      };
    }

    const { resumeText, jobDescription, questionType = 'mixed', workHistory, language } = parseResult.data;

    // Validate questionType
    if (!['behavioral', 'technical', 'mixed'].includes(questionType)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: 'Invalid questionType. Must be "behavioral", "technical", or "mixed".' })
      };
    }

    // Detect career vulnerabilities from structured work history
    const vulnerabilities = workHistory?.length
      ? detectVulnerabilities(workHistory)
      : [];

    // Use dedicated interview question prediction function
    const interviewPrep = await predictInterviewQuestions(resumeText, jobDescription, questionType, vulnerabilities, language);

    // Consume credits AFTER successful prediction
    const creditResult = await consumeCredits(userEmail, 'interview_prep');

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questions: interviewPrep.predicted_questions,
        roleLevel: interviewPrep.role_level,
        focusAreas: interviewPrep.focus_areas,
        creditsRemaining: creditResult.creditsRemaining,
      }),
    };

  } catch (error) {
    console.error("Predict questions error:", summarizeErrorForLog(error));
    // Strip PII before sending to Sentry - only send metadata
    let rawBody: Record<string, unknown> = {};
    try {
      rawBody = event.body ? JSON.parse(event.body) : {};
    } catch {
      rawBody = {};
    }
    captureError(error, {
      function: 'predict-questions',
      payload: {
        resumeTextLength: typeof rawBody.resumeText === 'string' ? rawBody.resumeText.length : 0,
        jobDescriptionLength: typeof rawBody.jobDescription === 'string' ? rawBody.jobDescription.length : 0,
        hasResumeText: Boolean(rawBody.resumeText),
        hasJobDescription: Boolean(rawBody.jobDescription),
      },
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to predict questions" }),
    };
  }
};

// Export handler with rate limiting applied
export const handler = withRateLimit("predict-questions", baseHandler);
