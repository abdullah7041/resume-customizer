import type { Handler } from "@netlify/functions";
import { buildResumeDocument } from "../lib/normalize-resume.js";
import {
  extractPlainTextFromArrayBuffer,
  inferMimeType,
} from "../lib/resumeText.js";
import { withRateLimit, checkBetaQuota, consumeBetaQuota } from "../lib/rate-limiter";
import { initSentry, captureError } from "../lib/sentry";

initSentry();

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
 * Extract structured resume data using DeepSeek OCR
 * Handles image-based documents and low-quality PDFs
 */
const extractWithDeepSeekOCR = async (
  arrayBuffer: ArrayBuffer,
  mimeType: string
): Promise<{ text: string; structured: any; usedOCR: boolean }> => {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("DeepSeek API key not configured");
  }

  // Convert to base64 for API transmission
  const buffer = Buffer.from(arrayBuffer);
  const base64Image = buffer.toString("base64");
  const dataUri = `data:${mimeType};base64,${base64Image}`;

  const prompt = `Extract ALL text from this resume image COMPLETELY. Structure it as JSON with these fields:
{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "phone number",
  "linkedin": "LinkedIn URL if present",
  "github": "GitHub URL if present",
  "portfolio": "Portfolio URL if present",
  "headline": "Job title/headline if present",
  "summary": "professional summary or objective - extract the COMPLETE text",
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "location": "Location if present",
      "duration": "Start - End",
      "responsibilities": ["bullet point 1", "bullet point 2", "...every bullet point"]
    }
  ],
  "education": [
    {
      "degree": "Degree Name",
      "institution": "School Name",
      "location": "Location if present",
      "year": "Graduation Year",
      "details": ["Any additional details like GPA, honors, coursework"]
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Project description",
      "highlights": ["bullet point 1", "bullet point 2"],
      "technologies": ["tech1", "tech2"]
    }
  ],
  "skills": {
    "technical": ["skill1", "skill2"],
    "soft": ["skill1", "skill2"],
    "tools": ["tool1", "tool2"],
    "languages": ["language1", "language2"]
  },
  "certifications": ["cert1", "cert2"],
  "training": ["training1", "training2"]
}

CRITICAL INSTRUCTIONS:
1. Extract EVERY piece of text you see - do not summarize or truncate
2. Include ALL bullet points for each job experience
3. Include ALL projects with their complete descriptions
4. Preserve the EXACT wording from the resume
5. Do NOT invent or infer information not visible in the image
Return valid JSON only - no markdown, no commentary.`;

  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUri } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({}));
      throw new Error(
        `DeepSeek OCR failed: ${error.error?.message || response.statusText}`
      );
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ||
      content.match(/(\{[\s\S]*\})/);

    if (!jsonMatch) {
      throw new Error("DeepSeek OCR did not return valid JSON");
    }

    const structured = JSON.parse(jsonMatch[1]);

    // Convert structured data back to plain text (comprehensive extraction)
    const textParts: string[] = [];
    if (structured.name) textParts.push(structured.name);
    if (structured.headline) textParts.push(structured.headline);
    if (structured.email) textParts.push(structured.email);
    if (structured.phone) textParts.push(structured.phone);
    if (structured.linkedin) textParts.push(structured.linkedin);
    if (structured.github) textParts.push(structured.github);
    if (structured.portfolio) textParts.push(structured.portfolio);

    if (structured.summary) textParts.push(`\n\nSUMMARY\n${structured.summary}`);

    if (structured.experience?.length) {
      textParts.push("\n\nEXPERIENCE");
      for (const exp of structured.experience) {
        textParts.push(`\n${exp.title} at ${exp.company}`);
        if (exp.location) textParts.push(`${exp.location}`);
        if (exp.duration) textParts.push(`${exp.duration}`);
        if (exp.responsibilities?.length) {
          textParts.push(...exp.responsibilities.map((r: string) => `• ${r}`));
        }
      }
    }

    if (structured.projects?.length) {
      textParts.push("\n\nPROJECTS");
      for (const project of structured.projects) {
        textParts.push(`\n${project.name}`);
        if (project.description) textParts.push(project.description);
        if (project.highlights?.length) {
          textParts.push(...project.highlights.map((h: string) => `• ${h}`));
        }
        if (project.technologies?.length) {
          textParts.push(`Technologies: ${project.technologies.join(", ")}`);
        }
      }
    }

    if (structured.education?.length) {
      textParts.push("\n\nEDUCATION");
      for (const edu of structured.education) {
        textParts.push(`\n${edu.degree} - ${edu.institution}${edu.location ? `, ${edu.location}` : ""} (${edu.year})`);
        if (edu.details?.length) {
          textParts.push(...edu.details.map((d: string) => `• ${d}`));
        }
      }
    }

    // Handle both array and object formats for skills
    if (structured.skills) {
      textParts.push("\n\nSKILLS");
      if (Array.isArray(structured.skills)) {
        textParts.push(structured.skills.join(", "));
      } else if (typeof structured.skills === 'object') {
        if (structured.skills.technical?.length) {
          textParts.push(`Technical: ${structured.skills.technical.join(", ")}`);
        }
        if (structured.skills.soft?.length) {
          textParts.push(`Soft Skills: ${structured.skills.soft.join(", ")}`);
        }
        if (structured.skills.tools?.length) {
          textParts.push(`Tools: ${structured.skills.tools.join(", ")}`);
        }
        if (structured.skills.languages?.length) {
          textParts.push(`Languages: ${structured.skills.languages.join(", ")}`);
        }
      }
    }

    if (structured.certifications?.length) {
      textParts.push("\n\nCERTIFICATIONS");
      textParts.push(structured.certifications.join(", "));
    }

    if (structured.training?.length) {
      textParts.push("\n\nTRAINING");
      textParts.push(structured.training.join(", "));
    }

    return {
      text: textParts.join("\n"),
      structured,
      usedOCR: true,
    };
  } catch (error) {
    throw new Error(
      `DeepSeek OCR extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

/**
 * Common resume keywords that should appear in legitimate resumes
 * Used to validate extraction quality
 */
const RESUME_INDICATORS = [
  'experience', 'education', 'skills', 'work', 'university', 'college',
  'bachelor', 'master', 'degree', 'project', 'developed', 'managed',
  'leadership', 'team', 'certification', 'proficient', 'expert',
  'responsible', 'achieved', 'implemented', 'designed', 'analyzed'
];

/**
 * Calculate character entropy to detect repetitive/garbled text
 * High entropy = diverse characters (good)
 * Low entropy = repetitive patterns like "I I I I" (bad)
 */
const calculateEntropy = (text: string): number => {
  if (!text || text.length === 0) return 0;

  const charFreq = new Map<string, number>();
  const normalized = text.toLowerCase().replace(/\s+/g, '');

  for (const char of normalized) {
    charFreq.set(char, (charFreq.get(char) || 0) + 1);
  }

  let entropy = 0;
  const length = normalized.length;

  for (const count of charFreq.values()) {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
};

/**
 * Check if text extraction resulted in very little or poor quality content
 * Indicates a scanned/image-based document that needs OCR
 */
const isLowQualityExtraction = (text: string): boolean => {
  const cleaned = text.trim();

  // Completely empty or very short
  if (cleaned.length < 50) return true;

  // Check for garbled text patterns (short words)
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 10) return true; // Too few words extracted

  const shortWords = words.filter(w => w.length <= 2).length;
  const shortWordRatio = shortWords / Math.max(words.length, 1);

  // Lowered threshold from 70% to 50%
  if (shortWordRatio > 0.5) return true;

  // Check character diversity (entropy)
  // Typical English text has entropy ~4.0-4.5
  // Garbled text like "I I I I" has low entropy ~1.0-2.0
  const entropy = calculateEntropy(cleaned);
  if (entropy < 2.5) return true;

  // Check for repetitive character patterns
  const charCounts = new Map<string, number>();
  for (const char of cleaned.toLowerCase().replace(/\s/g, '')) {
    charCounts.set(char, (charCounts.get(char) || 0) + 1);
  }

  // If any single character appears >40% of the time, likely garbled
  const maxCharFreq = Math.max(...charCounts.values());
  const repetitionRatio = maxCharFreq / cleaned.replace(/\s/g, '').length;
  if (repetitionRatio > 0.4) return true;

  // Check for resume-specific keywords
  const lowerText = cleaned.toLowerCase();
  const keywordMatches = RESUME_INDICATORS.filter(keyword =>
    lowerText.includes(keyword)
  ).length;

  // If no resume keywords found in substantial text, likely garbage
  if (cleaned.length > 200 && keywordMatches === 0) return true;
  if (cleaned.length > 100 && keywordMatches < 2) return true;

  return false;
};

/**
 * Calculate extraction quality score (0-1)
 * Used to warn users about poor OCR/extraction results
 */
const calculateExtractionQuality = (text: string): number => {
  if (!text || text.trim().length === 0) return 0;

  const cleaned = text.trim();
  let score = 1.0;

  // Penalize short extractions
  if (cleaned.length < 100) score *= 0.3;
  else if (cleaned.length < 200) score *= 0.6;
  else if (cleaned.length < 500) score *= 0.8;

  // Check word count and quality
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 20) score *= 0.4;
  else if (words.length < 50) score *= 0.7;

  // Penalize high ratio of short words
  const shortWords = words.filter(w => w.length <= 2).length;
  const shortWordRatio = shortWords / Math.max(words.length, 1);
  if (shortWordRatio > 0.5) score *= 0.3;
  else if (shortWordRatio > 0.3) score *= 0.6;

  // Check entropy
  const entropy = calculateEntropy(cleaned);
  if (entropy < 2.0) score *= 0.2;
  else if (entropy < 3.0) score *= 0.5;
  else if (entropy < 3.5) score *= 0.8;

  // Check for resume keywords
  const lowerText = cleaned.toLowerCase();
  const keywordMatches = RESUME_INDICATORS.filter(keyword =>
    lowerText.includes(keyword)
  ).length;

  const keywordScore = Math.min(keywordMatches / 5, 1.0);
  score *= (0.6 + 0.4 * keywordScore); // Keyword presence is weighted at 40%

  return Math.max(0, Math.min(1, score));
};

type ExtractionResult = {
  text: string;
  usedOCR: boolean;
  structured?: any;
  quality: number;
  warnings: string[];
};

const extractText = async (
  body: ParseResumeRequest
): Promise<ExtractionResult> => {
  if (body.kind === "text") {
    const text = typeof body.value === "string" ? body.value : "";
    const quality = calculateExtractionQuality(text);
    return {
      text,
      usedOCR: false,
      quality,
      warnings: quality < 0.5 ? ["Text quality is low. Ensure you've pasted the complete resume content."] : []
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
      const ocrResult = await extractWithDeepSeekOCR(arrayBuffer, mimeType);
      const quality = calculateExtractionQuality(ocrResult.text);
      return {
        ...ocrResult,
        quality,
        warnings: quality < 0.6 ? ["OCR extraction quality is moderate. Results may not be optimal."] : []
      };
    }

    // Try standard text extraction first for PDFs/DOCX
    const extractedText = await extractPlainTextFromArrayBuffer(arrayBuffer, {
      mimeType,
      fileName: body.name,
    });

    // If extraction was poor quality, try OCR fallback
    if (isLowQualityExtraction(extractedText) && process.env.DEEPSEEK_API_KEY) {
      console.log("[parse-resume] Low quality extraction detected, attempting OCR fallback");
      try {
        const ocrResult = await extractWithDeepSeekOCR(arrayBuffer, mimeType);
        const quality = calculateExtractionQuality(ocrResult.text);
        return {
          ...ocrResult,
          quality,
          warnings: quality < 0.6 ? ["OCR was used due to poor standard extraction. Quality may vary."] : []
        };
      } catch (ocrError) {
        console.warn("[parse-resume] OCR fallback failed, using standard extraction:", ocrError);
        // Fall back to the original extraction
        const quality = calculateExtractionQuality(extractedText);
        return {
          text: extractedText,
          usedOCR: false,
          quality,
          warnings: ["Text extraction quality is low. Consider uploading a text-based PDF or pasting content directly."]
        };
      }
    }

    const quality = calculateExtractionQuality(extractedText);
    return {
      text: extractedText,
      usedOCR: false,
      quality,
      warnings: quality < 0.6 ? ["Text extraction quality is low. Consider uploading a text-based PDF or pasting content directly."] : []
    };
  }

  throw new Error("Invalid parse request.");
};

const baseHandler: Handler = async (event) => {
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

  // Extract beta code from header
  const betaCode = event.headers["x-beta-code"] || event.headers["X-Beta-Code"];

  if (!betaCode) {
    return {
      statusCode: 401,
      headers: HEADERS,
      body: JSON.stringify({
        error: "Beta code required. Please sign in with a valid beta code."
      })
    };
  }

  // Check quota BEFORE processing
  const quotaStatus = await checkBetaQuota(betaCode, 'upload');

  if (!quotaStatus.allowed) {
    return {
      statusCode: 403,
      headers: HEADERS,
      body: JSON.stringify({
        error: quotaStatus.error || "Upload quota exceeded",
        quotaExceeded: true,
        used: quotaStatus.used,
        limit: quotaStatus.limit,
        remaining: quotaStatus.remaining,
        action: 'upload'
      })
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
    console.log(`[parse-resume] Extraction quality: ${(extractionResult.quality * 100).toFixed(1)}%`);
    console.log(`[parse-resume] Warnings: ${extractionResult.warnings.length > 0 ? extractionResult.warnings.join('; ') : 'None'}`);
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

    // Consume quota AFTER successful parse
    await consumeBetaQuota(betaCode, 'upload');

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        document: normalized,
        usedOCR: extractionResult.usedOCR,
        structured: extractionResult.structured,
        quality: extractionResult.quality,
        warnings: extractionResult.warnings,
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to parse resume.";
    captureError(error, {
      function: 'parse-resume',
      errorMessage: message,
    });
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

// Export handler with rate limiting applied
const handler = withRateLimit("parse-resume", baseHandler);
export { handler };
