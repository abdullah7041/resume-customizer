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

    // Preserve the FULL JSON Resume structure from Gemini parsing
    // The analysis object already contains: basics, work, education, skills, projects, certificates, etc.
    const document = {
      // Plain text for backward compatibility
      plainText: analysis.plainText || analysis.meta?.raw_text || "",

      // Full JSON Resume fields - these are properly parsed by Gemini
      basics: analysis.basics || {},
      work: analysis.work || [],
      education: analysis.education || [],
      skills: analysis.skills || [],
      projects: analysis.projects || [],
      certificates: analysis.certificates || [],
      languages: analysis.languages || [],

      // Legacy structured sections (backward compatibility)
      sections: [
        { title: "Contact", content: [`Name: ${analysis.basics?.name || ""}`, `Email: ${analysis.basics?.email || ""}`, `Phone: ${analysis.basics?.phone || ""}`] },
        { title: "Summary", content: [analysis.basics?.summary || ""] },
        { title: "Skills", content: (analysis.skills || []).flatMap(s => s.keywords || []) },
        { title: "Experience", content: (analysis.work || []).map(exp => `${exp.position || ""} at ${exp.name || ""} (${exp.startDate || ""} - ${exp.endDate || ""})`) },
        { title: "Education", content: (analysis.education || []).map(edu => `${edu.studyType || ""} ${edu.area || ""} from ${edu.institution || ""} (${edu.endDate || ""})`) },
        { title: "Projects", content: (analysis.projects || []).map(p => p.name || "") },
        { title: "Certifications", content: (analysis.certificates || []).map(c => c.name || "") }
      ],
      bullets: [],

      // Metadata
      meta: analysis.meta || {}
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
