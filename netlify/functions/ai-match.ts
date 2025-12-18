import { processResume } from "../lib/gemini-client";
import { withRateLimit } from "../lib/rate-limiter";
import { MatchRequestSchema, formatZodError } from "../lib/resume-schemas";
import { initSentry, captureError } from "../lib/sentry";

initSentry();

const baseHandler = async (event: { httpMethod: string; body: any; }) => {
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

    // We assume resumeText is text since the frontend sends text to this endpoint
    const analysis = await processResume(resumeText, jobDesc, false);
    const match = analysis.matchAnalysis;

    // Map to frontend expected format
    const response = {
      score: match.score_0_to_100,
      coverage: match.score_0_to_100 / 100, // Approximation
      similarity: match.score_0_to_100 / 100, // Approximation
      missingKeywords: match.missingKeywords,
      strongMatches: match.keywordsToKeep || [], // Keywords that match well
      matched_keywords: match.keywordsToKeep || [], // Alternative field name
      recommendations: match.hardSkillsGap,
      overallAssessment: match.reasoning,
      explanation: {
        reason: match.reasoning,
        tips: match.missingKeywords.map(k => `Consider adding ${k}`)
      },
      interviewPrep: analysis.interviewPrep
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
