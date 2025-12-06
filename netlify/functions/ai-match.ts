import { processResume } from "../lib/gemini-client";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const { resumeText, jobDesc } = body;

    if (!resumeText || !jobDesc) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing resumeText or jobDesc" }) };
    }

    // We assume resumeText is text since the frontend sends text to this endpoint
    const analysis = await processResume(resumeText, jobDesc, false);
    const match = analysis.matchAnalysis;

    // Map to frontend expected format
    const response = {
      score: match.score_0_to_100,
      coverage: match.score_0_to_100 / 100, // Approximation
      similarity: match.score_0_to_100 / 100, // Approximation
      missingKeywords: match.missingKeywords,
      strongMatches: [], // Gemini schema didn't explicitly ask for this, but we can infer or leave empty
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
    console.error("Match error stack:", error.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to analyze match" }),
    };
  }
};
