import { parseResumeOnly } from "../lib/gemini-client";
import { extractPlainTextFromArrayBuffer, inferMimeType } from "../lib/resumeText.js";

export const handler = async (event: { httpMethod: string; body: string; }) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Check for API key before proceeding
  if (!process.env.GEMINI_API_KEY) {
    console.error("[extract-resume-json] GEMINI_API_KEY is not set");
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server configuration error: AI service not configured" }),
    };
  }

  try {
    console.log(`[extract-resume-json] Received request. Method: ${event.httpMethod}`);
    const body = JSON.parse(event.body);
    const { data, kind, name, mime } = body;
    console.log(`[extract-resume-json] Payload kind: ${kind}, Data length: ${data ? data.length : 'N/A'}`);

    let analysis;
    let extractedPlainText = "";

    if (kind === "file" && data) {
      // CRITICAL FIX: Extract text from PDF/DOCX BEFORE sending to Gemini
      // This ensures we always have the full text regardless of Gemini's response
      try {
        const buffer = Buffer.from(data, "base64");
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        const mimeType = inferMimeType({ mimeType: mime, fileName: name });
        extractedPlainText = await extractPlainTextFromArrayBuffer(arrayBuffer, { mimeType, fileName: name });
        console.log(`[extract-resume-json] Pre-extracted text length: ${extractedPlainText.length} chars`);
        if (extractedPlainText.length > 0) {
          console.log(`[extract-resume-json] Pre-extracted preview: "${extractedPlainText.slice(0, 300).replace(/\s+/g, ' ')}"`);
        }
      } catch (extractError) {
        console.warn("[extract-resume-json] Pre-extraction failed, will rely on Gemini:", extractError);
      }

      console.log("[extract-resume-json] Calling parseResumeOnly with PDF data...");
      analysis = await parseResumeOnly(data, true);
      console.log("[extract-resume-json] parseResumeOnly returned success.");
    } else if (kind === "text" && body.value) {
      console.log("[extract-resume-json] Calling parseResumeOnly with text...");
      extractedPlainText = body.value;
      analysis = await parseResumeOnly(body.value, false);
    } else {
      console.warn("[extract-resume-json] Invalid input:", body);
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid input" }) };
    }

    // Use the best available plain text source:
    // 1. Pre-extracted text from PDF (most reliable)
    // 2. Gemini's plainText field
    // 3. Gemini's meta.raw_text field
    const geminiPlainText = analysis.plainText || analysis.meta?.raw_text || "";
    const bestPlainText = (extractedPlainText.length > geminiPlainText.length)
      ? extractedPlainText
      : (geminiPlainText || extractedPlainText);

    console.log(`[extract-resume-json] Final plainText length: ${bestPlainText.length} chars`);
    console.log(`[extract-resume-json] Source: ${extractedPlainText.length > geminiPlainText.length ? 'pre-extracted' : 'gemini'}`);

    // Preserve the FULL JSON Resume structure from Gemini parsing
    // The analysis object already contains: basics, work, education, skills, projects, certificates, etc.
    const document = {
      // Plain text for backward compatibility - USE THE BEST AVAILABLE SOURCE
      plainText: bestPlainText,

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
        { title: "Skills", content: Array.isArray(analysis.skills) ? analysis.skills.flatMap(s => typeof s === 'string' ? s : (s.keywords || [])) : [] },
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[extract-resume-json] Parse error:", errorMessage, error);

    // Provide more specific error messages based on the error type
    let userMessage = "Failed to parse resume";
    if (errorMessage.includes("API key")) {
      userMessage = "AI service configuration error";
    } else if (errorMessage.includes("quota") || errorMessage.includes("rate limit")) {
      userMessage = "AI service is currently busy. Please try again in a moment.";
    } else if (errorMessage.includes("JSON") || errorMessage.includes("parse")) {
      userMessage = "Failed to parse AI response. Please try again.";
    } else if (errorMessage.includes("timeout") || errorMessage.includes("network")) {
      userMessage = "Network error. Please check your connection and try again.";
    }

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: userMessage,
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined
      }),
    };
  }
};
