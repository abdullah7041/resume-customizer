import { processResume } from "../lib/gemini-client";
import { withRateLimit } from "../lib/rate-limiter";
import { PredictQuestionsRequestSchema, formatZodError } from "../lib/resume-schemas";
import { initSentry, captureError } from "../lib/sentry";

initSentry();

const baseHandler = async (event: { httpMethod: string; body: any; }) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
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

    const analysis = await processResume(resumeText, jobDescription, false);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questions: analysis.interviewPrep.predicted_questions,
        roleLevel: analysis.interviewPrep.role_level,
        focusAreas: analysis.interviewPrep.focus_areas
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
