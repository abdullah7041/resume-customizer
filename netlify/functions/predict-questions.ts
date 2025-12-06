import { processResume } from "../lib/gemini-client";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const { resumeText, jobDescription } = body;

    const analysis = await processResume(resumeText, jobDescription, false);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions: analysis.interviewPrep.predicted_questions }),
    };

  } catch {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to predict questions" }),
    };
  }
};
