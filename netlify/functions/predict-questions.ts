import { predictInterviewQuestions } from "../lib/gemini-client";
import { withRateLimit, checkBetaQuota, consumeBetaQuota } from "../lib/rate-limiter";
import { PredictQuestionsRequestSchema, formatZodError } from "../lib/resume-schemas";
import { initSentry, captureError } from "../lib/sentry";

initSentry();

const baseHandler = async (event: { httpMethod: string; body: any; headers: any; }) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Extract beta code from header
  const betaCode = event.headers["x-beta-code"] || event.headers["X-Beta-Code"];

  if (!betaCode) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Beta code required. Please sign in with a valid beta code." })
    };
  }

  // Check quota BEFORE processing
  const quotaStatus = await checkBetaQuota(betaCode, 'predict');

  if (!quotaStatus.allowed) {
    return {
      statusCode: 403,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: quotaStatus.error || "Interview prediction quota exceeded",
        quotaExceeded: true,
        used: quotaStatus.used,
        limit: quotaStatus.limit,
        remaining: quotaStatus.remaining,
        action: 'predict'
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

    const { resumeText, jobDescription } = parseResult.data;

    // Use dedicated interview question prediction function
    const interviewPrep = await predictInterviewQuestions(resumeText, jobDescription);

    // Consume quota AFTER successful prediction
    await consumeBetaQuota(betaCode, 'predict');

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questions: interviewPrep.predicted_questions,
        roleLevel: interviewPrep.role_level,
        focusAreas: interviewPrep.focus_areas
      }),
    };

  } catch (error) {
    console.error("Predict questions error:", error);
    captureError(error, {
      function: 'predict-questions',
      payload: JSON.parse(event.body || '{}'),
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to predict questions" }),
    };
  }
};

// Export handler with rate limiting applied
export const handler = withRateLimit("predict-questions", baseHandler);
