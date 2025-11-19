import type { Handler } from "@netlify/functions";
import { buildResumeDocument } from "../lib/normalize-resume.js";
import {
  extractPlainTextFromArrayBuffer,
  inferMimeType,
} from "../lib/resumeText.js";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
} as const;

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
]);

type ParseResumeRequest =
  | {
      kind: "text";
      value?: string;
    }
  | {
      kind: "file";
      name?: string;
      mime?: string;
      data?: string;
    };

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB safety guard

const decodeBase64 = (value: string): ArrayBuffer => {
  try {
    const buffer = Buffer.from(value, "base64");
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  } catch {
    throw new Error("Invalid file encoding.");
  }
};

/**
 * Extract structured resume data using OpenAI Vision API
 * Handles image-based documents and low-quality PDFs
 * More reliable than DeepSeek API
 */
const extractWithVisionOCR = async (
  arrayBuffer: ArrayBuffer,
  mimeType: string
): Promise<{ text: string; structured: any; usedOCR: boolean }> => {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.VITE_OPENAI_KEY;

  if (!apiKey) {
    throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY environment variable.");
  }

  // Convert to base64 for API transmission
  const buffer = Buffer.from(arrayBuffer);
  const base64Image = buffer.toString("base64");
  const dataUri = `data:${mimeType};base64,${base64Image}`;

  const prompt = `Extract all text from this resume image and structure it as JSON with these fields:
{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "phone number",
  "summary": "professional summary or objective",
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "duration": "Start - End",
      "responsibilities": ["bullet point 1", "bullet point 2"]
    }
  ],
  "education": [
    {
      "degree": "Degree Name",
      "institution": "School Name",
      "year": "Graduation Year"
    }
  ],
  "skills": ["skill1", "skill2", "skill3"],
  "certifications": ["cert1", "cert2"]
}

CRITICAL: Extract ONLY what you see. Do NOT invent information.
Return valid JSON only - no markdown, no commentary.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Cost-effective vision model
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: dataUri,
                  detail: "high" // High detail for better OCR accuracy
                }
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({}));
      const errorMessage = error.error?.message || response.statusText;
      throw new Error(`OpenAI Vision OCR failed: ${errorMessage}`);
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ||
                     content.match(/(\{[\s\S]*\})/);

    if (!jsonMatch) {
      throw new Error("OpenAI Vision OCR did not return valid JSON");
    }

    const structured = JSON.parse(jsonMatch[1]);

    // Convert structured data back to plain text
    const textParts: string[] = [];
    if (structured.name) textParts.push(structured.name);
    if (structured.email) textParts.push(structured.email);
    if (structured.phone) textParts.push(structured.phone);
    if (structured.summary) textParts.push(`\n${structured.summary}`);

    if (structured.experience?.length) {
      textParts.push("\n\nEXPERIENCE");
      for (const exp of structured.experience) {
        textParts.push(`\n${exp.title} at ${exp.company}`);
        if (exp.duration) textParts.push(`${exp.duration}`);
        if (exp.responsibilities?.length) {
          textParts.push(...exp.responsibilities.map((r: string) => `• ${r}`));
        }
      }
    }

    if (structured.education?.length) {
      textParts.push("\n\nEDUCATION");
      for (const edu of structured.education) {
        textParts.push(`\n${edu.degree} - ${edu.institution} (${edu.year})`);
      }
    }

    if (structured.skills?.length) {
      textParts.push("\n\nSKILLS");
      textParts.push(structured.skills.join(", "));
    }

    if (structured.certifications?.length) {
      textParts.push("\n\nCERTIFICATIONS");
      textParts.push(structured.certifications.join(", "));
    }

    return {
      text: textParts.join("\n"),
      structured,
      usedOCR: true,
    };
  } catch (error) {
    throw new Error(
      `Vision OCR extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

/**
 * Check if text extraction resulted in very little content
 * Indicates a scanned/image-based document
 */
const isLowQualityExtraction = (text: string): boolean => {
  const cleaned = text.trim();
  if (cleaned.length < 50) return true;
  
  // Check for garbled text patterns
  const words = cleaned.split(/\s+/);
  const shortWords = words.filter(w => w.length <= 2).length;
  const wordRatio = shortWords / Math.max(words.length, 1);
  
  return wordRatio > 0.7; // More than 70% short words indicates poor extraction
};

const extractText = async (
  body: ParseResumeRequest
): Promise<{ text: string; usedOCR: boolean; structured?: any }> => {
  if (body.kind === "text") {
    return { 
      text: typeof body.value === "string" ? body.value : "",
      usedOCR: false 
    };
  }

  if (body.kind === "file") {
    if (!body.data) {
      throw new Error("File payload missing content.");
    }

    const arrayBuffer = decodeBase64(body.data);
    if (!arrayBuffer.byteLength) {
      throw new Error("File payload was empty.");
    }
    if (arrayBuffer.byteLength > MAX_BYTES) {
      throw new Error("File exceeds the maximum supported size (8 MB).");
    }

    const mimeType = inferMimeType({ mimeType: body.mime, fileName: body.name });
    
    // Check if it's an image file
    const isImage = IMAGE_MIME_TYPES.has(mimeType);
    
    if (isImage) {
      // Images always need OCR
      return await extractWithVisionOCR(arrayBuffer, mimeType);
    }

    // Try standard text extraction first for PDFs/DOCX
    const extractedText = await extractPlainTextFromArrayBuffer(arrayBuffer, {
      mimeType,
      fileName: body.name,
    });

    // If extraction was poor quality, try OCR fallback
    const hasOCRApiKey = process.env.OPENAI_API_KEY ?? process.env.VITE_OPENAI_KEY;
    if (isLowQualityExtraction(extractedText) && hasOCRApiKey) {
      console.log("[parse-resume] Low quality extraction detected, attempting OCR fallback");
      try {
        return await extractWithVisionOCR(arrayBuffer, mimeType);
      } catch (ocrError) {
        console.warn("[parse-resume] OCR fallback failed, using standard extraction:", ocrError);
        // Fall back to the original extraction
        return { text: extractedText, usedOCR: false };
      }
    }
    
    return { text: extractedText, usedOCR: false };
  }

  throw new Error("Invalid parse request.");
};

const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: HEADERS,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const rawBody = event.body ? JSON.parse(event.body) : {};
    
    // Handle direct text input or normalize to ParseResumeRequest format
    let body: ParseResumeRequest;
    if (typeof rawBody.text === "string") {
      // Direct text payload from Postman
      body = { kind: "text", value: rawBody.text };
    } else if (rawBody.kind === "text" || rawBody.kind === "file") {
      // Already in correct format
      body = rawBody as ParseResumeRequest;
    } else if (typeof rawBody.data === "string" || typeof rawBody.name === "string") {
      // File upload format
      body = {
        kind: "file",
        name: rawBody.name,
        mime: rawBody.mime,
        data: rawBody.data,
      };
    } else {
      // Default to empty text
      body = { kind: "text", value: "" };
    }
    
    const extractionResult = await extractText(body);

    // 🔍 DEBUG LOGGING: Log extraction quality metrics
    console.log("=========== PARSE RESUME DEBUG ===========");
    console.log(`[parse-resume] Extraction method: ${extractionResult.usedOCR ? 'DeepSeek OCR' : 'Standard PDF/DOCX parsing'}`);
    console.log(`[parse-resume] Raw text length: ${extractionResult.text.length} characters`);
    console.log(`[parse-resume] First 200 chars: "${extractionResult.text.slice(0, 200)}"`);
    console.log(`[parse-resume] Text preview (cleaned): "${extractionResult.text.trim().slice(0, 300).replace(/\s+/g, ' ')}"`);

    const normalized = buildResumeDocument(extractionResult.text);

    console.log(`[parse-resume] Normalized plainText length: ${normalized.plainText?.length || 0} characters`);
    console.log(`[parse-resume] Bullets extracted: ${normalized.bullets?.length || 0}`);
    console.log(`[parse-resume] Sections extracted: ${normalized.sections?.length || 0}`);
    console.log("==========================================");

    if (!normalized.plainText || normalized.plainText.trim().length === 0) {
      console.error("[parse-resume] ❌ EXTRACTION FAILED: No text extracted from document");
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({
          error:
            "Unable to extract readable text from the resume. Please ensure your PDF contains selectable text (not scanned images). Try uploading a different format or pasting the text directly.",
        }),
      };
    }

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ 
        document: normalized,
        usedOCR: extractionResult.usedOCR,
        structured: extractionResult.structured,
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to parse resume.";
    const userMessage = message.includes("Unsupported")
      ? "Unsupported file type. Please upload a PDF or DOCX file, or paste your resume text directly."
      : message.includes("exceeds")
      ? "File is too large. Please use a file smaller than 8 MB."
      : `Unable to parse resume: ${message}`;

    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ error: userMessage }),
    };
  }
};

export { handler };
