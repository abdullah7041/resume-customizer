import { processResume } from "../lib/gemini-client";
import { withRateLimit } from "../lib/rate-limiter";
import { CoverLetterRequestSchema, formatZodError } from "../lib/resume-schemas";
import { initSentry, captureError } from "../lib/sentry";

initSentry();

const baseHandler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
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

    const analysis = await processResume(resumeText, jobDescription, false);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coverLetter: analysis.coverLetter.draft_text }),
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
