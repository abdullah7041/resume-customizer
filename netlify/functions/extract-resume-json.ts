import { parseResumeOnly } from "../lib/gemini-client";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    console.log(`[extract-resume-json] Received request. Method: ${event.httpMethod}`);
    const body = JSON.parse(event.body);
    const { data, kind } = body;
    console.log(`[extract-resume-json] Payload kind: ${kind}, Data length: ${data ? data.length : 'N/A'}`);

    let analysis;
    if (kind === "file" && data) {
      console.log("[extract-resume-json] Calling parseResumeOnly with PDF data...");
      analysis = await parseResumeOnly(data, true);
      console.log("[extract-resume-json] parseResumeOnly returned success.");
    } else if (kind === "text" && body.value) {
      console.log("[extract-resume-json] Calling parseResumeOnly with text...");
      analysis = await parseResumeOnly(body.value, false);
    } else {
      console.warn("[extract-resume-json] Invalid input:", body);
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid input" }) };
    }

    // Map Gemini output to the format expected by the frontend
    const profile = analysis.candidateProfile || {};

    // Construct a "document" object that mimics the old parser output
    const document = {
      plainText: analysis.plainText || `Name: ${profile.name}\nEmail: ${profile.email}\nSkills: ${profile.skills?.join(", ")}`,
      sections: [
        { title: "Contact", content: [`Name: ${profile.name}`, `Email: ${profile.email}`, `Phone: ${profile.phone}`, `Location: ${profile.location}`] },
        { title: "Summary", content: [analysis.summary] },
        { title: "Skills", content: analysis.skills || [] },
        { title: "Experience", content: analysis.experience?.map(exp => `${exp.title} at ${exp.company} (${exp.dates}): ${exp.description}`) || [] },
        { title: "Education", content: analysis.education?.map(edu => `${edu.degree} from ${edu.school} (${edu.dates})`) || [] }
      ],
      bullets: []
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document }),
    };

  } catch (error) {
    console.error("Parse error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to parse resume" }),
    };
  }
};
