import { generateCoverLetter } from "../lib/gemini-client";
import { withRateLimit, checkBetaQuota, consumeBetaQuota } from "../lib/rate-limiter";
import { CoverLetterRequestSchema, formatZodError } from "../lib/resume-schemas";
import { initSentry, captureError } from "../lib/sentry";

initSentry();

const baseHandler = async (event) => {
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
  const quotaStatus = await checkBetaQuota(betaCode, 'coverLetter');

  if (!quotaStatus.allowed) {
    return {
      statusCode: 403,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: quotaStatus.error || "Cover letter generation quota exceeded",
        quotaExceeded: true,
        used: quotaStatus.used,
        limit: quotaStatus.limit,
        remaining: quotaStatus.remaining,
        action: 'coverLetter'
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

    const { resumeText, jobDescription } = parseResult.data;

    const result = await generateCoverLetter(resumeText, jobDescription);

    // Consume quota AFTER successful generation
    await consumeBetaQuota(betaCode, 'coverLetter');

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coverLetter: result.draft_text }),
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
