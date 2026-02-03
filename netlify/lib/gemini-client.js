// OpenRouter API client for Gemini models
import { callOpenRouter, MODELS } from './openrouter-client.js';

// Shared schema for category scores (used by processMatchOnly & optimizeResume)
// Note: No longer using SchemaType - plain JSON Schema objects
const CATEGORY_SCORE_SCHEMA = {
  type: "object",
  properties: {
    hard_skills: { type: "object", properties: { score: { type: "number" }, max: { type: "number" }, reasoning: { type: "string" } }, required: ["score", "max", "reasoning"] },
    experience: { type: "object", properties: { score: { type: "number" }, max: { type: "number" }, reasoning: { type: "string" } }, required: ["score", "max", "reasoning"] },
    education: { type: "object", properties: { score: { type: "number" }, max: { type: "number" }, reasoning: { type: "string" } }, required: ["score", "max", "reasoning"] },
    soft_skills: { type: "object", properties: { score: { type: "number" }, max: { type: "number" }, reasoning: { type: "string" } }, required: ["score", "max", "reasoning"] }
  },
  required: ["hard_skills", "experience", "education", "soft_skills"]
};

/**
 * Sanitize and parse JSON response from Gemini.
 * Handles common issues: markdown code blocks, unescaped characters, truncation.
 * @param {string} text - Raw response text from Gemini
 * @returns {object} - Parsed JSON object
 */
function sanitizeAndParseJSON(text) {
  let cleaned = text;

  // 1. Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

  // 2. Trim whitespace
  cleaned = cleaned.trim();

  // 3. Try to parse as-is first
  try {
    return JSON.parse(cleaned);
  } catch (parseError) {
    console.warn('[Gemini] First JSON parse attempt failed:', parseError.message);
    console.warn('[Gemini] Trying sanitization...');

    // 4. Fix common issues: control characters in strings
    // Replace unescaped control characters (except \n, \r, \t which are valid in JSON)
    // Using character class with explicit ranges to avoid ESLint no-control-regex
    // eslint-disable-next-line no-control-regex
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');

    // 5. Try to fix truncated JSON by finding a valid truncation point
    console.warn('[Gemini] Response appears truncated, attempting to repair JSON...');

    // Strategy: Find the last complete property or array element by looking for
    // the last occurrence of }, ], or a complete "key": "value" pair

    // First, find if we're in the middle of a string by counting quotes
    let quoteCount = 0;
    let lastValidEnd = -1;
    let escaped = false;

    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        quoteCount++;
      }

      // Track positions of complete structures (outside strings)
      if (quoteCount % 2 === 0) {
        if (char === '}' || char === ']') {
          lastValidEnd = i;
        }
      }
    }

    // If we found a valid end point AND the last character is not closing a structure,
    // we may have trailing garbage. BUT if we're in a string, don't truncate yet - 
    // we'll handle string closure in the next step to preserve more data.
    const lastChar = cleaned.charAt(cleaned.length - 1);
    const isLastCharStructure = lastChar === '}' || lastChar === ']' || lastChar === '"';

    // Only truncate if we're NOT in the middle of a string (quoteCount is even)
    // and there's actual trailing garbage after the last valid structure
    if (lastValidEnd > 0 && lastValidEnd < cleaned.length - 1 && quoteCount % 2 === 0 && !isLastCharStructure) {
      console.warn(`[Gemini] Truncating at position ${lastValidEnd} to find valid JSON end`);
      cleaned = cleaned.substring(0, lastValidEnd + 1);
    } else if (quoteCount % 2 !== 0) {
      // We're in middle of a string - log but don't truncate, we'll close it next
      console.warn(`[Gemini] Detected unterminated string at position ${cleaned.length}, will attempt to close it`);
    }

    // Count remaining open braces/brackets
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    escaped = false;

    for (const char of cleaned) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;
      }
    }

    // If we're still in a string, close it and clean up
    if (inString) {
      cleaned += '"';
      // Remove trailing incomplete key-value pairs that would cause parse errors
      // Patterns to handle:
      // - Incomplete URL: "url": "https://incomplete" -> remove if no closing structure
      // - Truncated content: "text": "some text that got cut" -> keep but ensure valid

      // First, try to find and remove any trailing incomplete property
      // Look for patterns like: , "key": "value that might be incomplete
      const trailingIncomplete = cleaned.match(/,\s*"[^"]+"\s*:\s*"[^"]*"\s*$/);
      if (trailingIncomplete) {
        // Check if this looks like a complete key-value pair (has content after the colon)
        const match = trailingIncomplete[0];
        // If the value part is very short or looks like a truncated URL/path, remove it
        if (match.includes('://') && !match.includes(' ')) {
          // Likely a truncated URL - remove the whole property
          cleaned = cleaned.slice(0, -match.length);
          console.warn('[Gemini] Removed truncated URL property');
        }
      }
    }

    // Remove any trailing commas
    cleaned = cleaned.replace(/,\s*$/, '');

    // Close arrays then objects
    while (bracketCount > 0) {
      cleaned += ']';
      bracketCount--;
    }
    while (braceCount > 0) {
      cleaned += '}';
      braceCount--;
    }

    // 6. Second parse attempt
    try {
      const result = JSON.parse(cleaned);
      console.log('[Gemini] JSON repair successful');
      return result;
    } catch (secondError) {
      // 7. Last resort: try to extract just the basics object if it exists
      console.warn('[Gemini] Standard repair failed, trying to extract partial data...');

      try {
        // Look for a complete "basics" section at minimum
        const basicsMatch = cleaned.match(/"basics"\s*:\s*\{[^}]+\}/);
        if (basicsMatch) {
          // Try to build a minimal valid response
          const minimalJSON = `{"basics": ${basicsMatch[0].replace('"basics":', '').trim()}}`;
          const minimal = JSON.parse(minimalJSON);
          console.log('[Gemini] Extracted minimal basics object');
          return minimal;
        }
      } catch {
        // Ignore extraction errors
      }

      console.error('[Gemini] JSON sanitization failed. Raw text preview:', text.substring(0, 500));
      throw new Error(`Failed to parse AI response: ${secondError.message}. Response preview: ${text.substring(0, 200)}...`);
    }
  }
}

/**
 * Parses a resume to extract full text and structured data.
 * Returns JSON Resume format for complete content extraction.
 * @param {string} inputData - Base64 encoded PDF data OR plain text resume.
 * @param {boolean} isPdf - True if inputData is base64 PDF, false if text.
 * @returns {Promise<object>} - JSON Resume schema with plainText extension.
 */
export async function parseResumeOnly(inputData, isPdf = true) {
  // OpenRouter doesn't support inline PDF data - must use text mode only
  if (isPdf) {
    throw new Error('PDF inline data not supported with OpenRouter. Please convert PDF to text first using OCR.');
  }

  try {
    console.log(`[OpenRouter] Parsing resume with ${MODELS.lite}. Input type: Text`);

    const systemInstruction = `You are a highly accurate OCR and resume parser.
Your goal is to extract the FULL text verbatim and structure the data.
You MUST output JSON strictly adhering to the JSONResume.org schema standard.

CRITICAL EXTRACTION REQUIREMENTS:

1. WORK EXPERIENCE - For each job, extract:
   - name: Company name (REQUIRED)
   - position: Job title (REQUIRED)
   - location: City/Region (e.g., "Alahsa, Saudi Arabia", "Dammam, Saudi Arabia") - REQUIRED if present
   - startDate: Start date
   - endDate: End date or "Present"
   - highlights: Array of ALL bullet points/achievements - DO NOT OMIT ANY

2. EDUCATION - For each entry, extract:
   - institution: School/University name (REQUIRED)
   - area: Field of study/Major
   - studyType: Degree type (Diploma, Bachelor, Master, PhD, etc.)
   - startDate: Start date
   - endDate: End date
   - score: GPA if mentioned
   - highlights: Array of ALL bullet points describing the education (REQUIRED if present)
     Examples to look for:
     - "First Year: Focused on academic coursework..."
     - "Second Year: Hands-on workshop courses..."
     - "Dean's List 2020-2022"
     - "Senior project: Developed a..."
   - courses: Array of relevant coursework if mentioned

3. PROJECTS - For each project:
   - name: Project name
   - description: Brief description
   - highlights: Array of ALL bullet points
   - keywords: Technologies used

4. SKILLS - Group by category if present:
   - Technical Skills, Programming Languages, Soft Skills, etc.
   each group should have name and keywords array.

5. CERTIFICATIONS - Extract all certifications/licenses/trainings:
   - Look for headers like: "Certifications", "Licenses", "Training", "Credentials", "Professional Development"
   - Also look for "Certified..." or "License..." mentions in text.
   - For each, extract:
     - name: Certificate name (REQUIRED)
     - issuer: Issuing organization (e.g., Coursera, AWS, SCOPA)
     - date: Date obtained

6. LANGUAGES - Extract language proficiencies

DO NOT OMIT any bullet points or details. Include EVERY piece of information from the resume.
Location is REQUIRED for each work entry if mentioned in the resume.
Education highlights (bullet points describing coursework/achievements) are REQUIRED if present.
If you are unsure if a section exists but see text that looks like it (e.g. a list of courses under specific years), extract it as best interpretation.`;

    const prompt = `
Extract the following information from the resume.
IMPORTANT: "meta.raw_text" must contain the COMPLETE text of the resume, preserving line breaks and structure. Do not summarize; extract fully.

CRITICAL: Extract LOCATION for each work experience and HIGHLIGHTS for education entries.

Return the response in JSON Resume format:
{
  "basics": {
    "name": "string",
    "label": "string (Job Title / Professional Headline)",
    "email": "string",
    "phone": "string",
    "url": "string (optional)",
    "summary": "string (professional summary)",
    "location": {
      "city": "string",
      "countryCode": "string",
      "region": "string"
    },
    "profiles": [{ "network": "string", "username": "string", "url": "string" }]
  },
  "work": [
    {
      "name": "string (Company name)",
      "position": "string (Job Title)",
      "location": "string (City, Country - REQUIRED if present in resume, e.g. 'Alahsa, Saudi Arabia')",
      "startDate": "string (YYYY-MM format)",
      "endDate": "string (YYYY-MM or 'Present')",
      "summary": "string (optional role overview)",
      "highlights": ["string (EVERY bullet point - do not skip any)"]
    }
  ],
  "education": [
    {
      "institution": "string (School/University name)",
      "area": "string (Major/Field of Study)",
      "studyType": "string (Degree: Diploma, Bachelor, Master, PhD, etc.)",
      "startDate": "string",
      "endDate": "string",
      "score": "string (GPA if mentioned)",
      "courses": ["string (relevant coursework if listed)"],
      "highlights": ["string (EVERY bullet point about the education, year-by-year details like 'First Year: ...', 'Second Year: ...', achievements, etc.)"]
    }
  ],
  "skills": [
    {
      "name": "string (Category: Technical Skills, Soft Skills, etc.)",
      "keywords": ["string (individual skills in this category)"]
    }
  ],
  "projects": [
    {
      "name": "string (REQUIRED - The actual project title. NEVER use generic names like 'Project' or 'Project 1'. Extract real names like 'Sales Dashboard', 'Inventory Tracker', etc.)",
      "description": "string (Brief summary, separate from name)",
      "highlights": ["string (EVERY bullet point - do not duplicate description)"],
      "keywords": ["string (technologies used)"]
    }
  ],
  "certificates": [
    {
      "name": "string",
      "date": "string",
      "issuer": "string"
    }
  ],
  "languages": [
    {
      "language": "string",
      "fluency": "string (Native, Fluent, Upper Intermediate, Intermediate, Basic)"
    }
  ],
  "meta": {
    "version": "1.0.0",
    "lastModified": "string (ISO date)",
    "raw_text": "string (The FULL verbatim text of the resume)"
  }
}

CRITICAL REMINDERS:
- Extract LOCATION for each work experience (e.g., "Dammam, Saudi Arabia")
- Extract ALL education highlights/bullet points (e.g., "First Year: focused on academic coursework...")
- Map ALL experience entries to "work[]" with every bullet point in "highlights[]"
- DO NOT skip or summarize any content
`;

    // Build prompt with system instruction and user content
    const fullPrompt = `${systemInstruction}\n\n${prompt}\n\nRESUME CONTENT:\n${inputData}`;

    const messages = [{ role: 'user', content: fullPrompt }];
    const text = await callOpenRouter('lite', messages, null, { temperature: 0, maxTokens: 8192 });
    const parsed = sanitizeAndParseJSON(text);

    // CRITICAL FIX: Safely extract plainText as string
    // Gemini may return raw_text as an object in some cases
    const rawTextValue = parsed.meta?.raw_text;

    // DEBUG: Log what we're receiving
    console.log("[Gemini] DEBUG: parsed.meta exists:", !!parsed.meta);
    console.log("[Gemini] DEBUG: typeof rawTextValue:", typeof rawTextValue);
    console.log("[Gemini] DEBUG: rawTextValue preview:",
      typeof rawTextValue === 'string' ? rawTextValue.substring(0, 100) : JSON.stringify(rawTextValue)?.substring(0, 200));

    let extractedPlainText = "";
    if (typeof rawTextValue === "string") {
      extractedPlainText = rawTextValue;
    } else if (rawTextValue && typeof rawTextValue === "object") {
      // Try to extract from object if it has a text-like property
      if (typeof rawTextValue.text === "string") extractedPlainText = rawTextValue.text;
      else if (typeof rawTextValue.content === "string") extractedPlainText = rawTextValue.content;
      else {
        console.warn("[Gemini] ⚠️ meta.raw_text is an object, not string:", JSON.stringify(rawTextValue).substring(0, 200));
      }
    } else {
      console.warn("[Gemini] ⚠️ meta.raw_text is empty/undefined, type:", typeof rawTextValue);
    }

    console.log("[Gemini] DEBUG: extractedPlainText length:", extractedPlainText.length);
    parsed.plainText = extractedPlainText;
    parsed.candidateProfile = {
      name: parsed.basics?.name || "",
      email: parsed.basics?.email || "",
      phone: parsed.basics?.phone || "",
      location: parsed.basics?.location ?
        `${parsed.basics.location.city || ""}, ${parsed.basics.location.region || ""}`.trim().replace(/^,\s*|,\s*$/g, "") : "",
      links: (parsed.basics?.profiles || []).map(p => p.url).filter(Boolean)
    };
    // CRITICAL FIX: Extract summary from raw_text if basics.summary is missing/short
    let summary = parsed.basics?.summary || "";
    if ((!summary || summary.length < 50) && extractedPlainText) {
      // Try to find summary section in raw text
      const summaryMatch = extractedPlainText.match(
        /(?:SUMMARY|PROFESSIONAL SUMMARY|PROFILE|OBJECTIVE|ABOUT)[:\s]*\n?([\s\S]*?)(?=\n\n|\n(?:EXPERIENCE|WORK|EDUCATION|SKILLS|CERTIFICATIONS?|PROJECTS?|$))/i
      );
      if (summaryMatch && summaryMatch[1]) {
        const extractedSummary = summaryMatch[1].trim();
        if (extractedSummary.length > 50) {
          summary = extractedSummary;
          // Also update basics.summary for consistency
          if (parsed.basics) parsed.basics.summary = summary;
          console.log("[Gemini] Extracted summary from raw_text, length:", summary.length);
        }
      }
    }
    parsed.summary = summary;
    parsed.skills = (parsed.skills || []).flatMap(s => s.keywords || []);
    parsed.experience = (parsed.work || []).map(w => ({
      title: w.position || "",
      company: w.name || "",
      dates: `${w.startDate || ""} - ${w.endDate || ""}`.trim(),
      description: [w.summary, ...(w.highlights || [])].filter(Boolean).join("\n• ")
    }));
    parsed.certifications = (parsed.certificates || []).map(c => c.name);

    // Validation & Fallbacks
    if (!parsed.work) {
      console.warn("[Gemini] ⚠️ 'work' array missing in response, defaulting to []");
      parsed.work = [];
    }
    if (!parsed.education) {
      console.warn("[Gemini] ⚠️ 'education' array missing in response, defaulting to []");
      parsed.education = [];
    }
    if (!parsed.skills || parsed.skills.length === 0) {
      console.warn("[Gemini] ⚠️ 'skills' array empty or missing");
      parsed.skills = []; // Keep as array
    }
    if (!parsed.certificates) {
      // Not critical, but good to have
      parsed.certificates = [];
    }

    // Log finding summary
    console.log(`[Gemini] Extraction Summary:
      - Work: ${parsed.work.length} entries
      - Education: ${parsed.education.length} entries
      - Skills: ${parsed.skills.length} keywords
      - Certificates: ${parsed.certificates.length} entries
      - Projects: ${parsed.projects?.length || 0} entries
    `);

    return parsed;

  } catch (error) {
    console.error("[OpenRouter] Error parsing resume:", error);

    // Preserve and enrich the original error message
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("API_KEY") || errorMessage.includes("permission") || errorMessage.includes("403")) {
      throw new Error("API key error: Please verify your OPENROUTER_API_KEY is valid and has proper permissions.");
    }

    if (errorMessage.includes("quota") || errorMessage.includes("429")) {
      throw new Error("API quota exceeded. Please try again later.");
    }

    if (errorMessage.includes("model") || errorMessage.includes("404")) {
      throw new Error(`Model error: The model '${MODELS.lite}' may not be available. Please check the model name.`);
    }

    throw error;
  }
}

/**
 * Optimizes a resume against a job description using Gemini.
 * Focused function for generating optimization suggestions only.
 * @param {string} resumeText - Plain text resume content.
 * @param {string} jobDescription - Job description text.
 * @returns {Promise<object>} - Optimization suggestions with original and improved content.
 */
export async function optimizeResume(resumeText, jobDescription) {
  const schema = {
    type: "object",
    properties: {
      match_score: { type: "number" },
      category_scores: CATEGORY_SCORE_SCHEMA,
      gap_analysis: { type: "array", items: { type: "object", properties: { requirement: { type: "string" }, current_state: { type: "string" }, gap_severity: { type: "string" }, recommendation: { type: "string" } }, required: ["requirement", "current_state", "gap_severity", "recommendation"] } },
      original_headline: { type: "string" },
      suggested_headline: { type: "string" },
      original_summary: { type: "string" },
      summary_rewrite: { type: "string" },
      bullet_improvements: { type: "array", items: { type: "object", properties: { original: { type: "string" }, improved: { type: "string" }, issue: { type: "string" }, rationale: { type: "string" } }, required: ["original", "improved", "issue", "rationale"] } },
      project_improvements: { type: "array", items: { type: "object", properties: { project_name: { type: "string" }, original: { type: "string" }, improved: { type: "string" }, issue: { type: "string" }, rationale: { type: "string" } }, required: ["project_name", "original", "improved", "issue", "rationale"] } },
      certification_recommendations: { type: "array", items: { type: "object", properties: { name: { type: "string" }, issuer: { type: "string" }, relevance: { type: "string" } }, required: ["name", "issuer", "relevance"] } },
      missing_keywords: { type: "array", items: { type: "string" } },
      keywords_to_keep: { type: "array", items: { type: "string" } },
      keywords_to_avoid: { type: "array", items: { type: "string" } }
    },
    required: ["match_score", "category_scores", "gap_analysis", "original_headline", "suggested_headline", "original_summary", "summary_rewrite", "bullet_improvements", "project_improvements", "certification_recommendations", "missing_keywords", "keywords_to_keep", "keywords_to_avoid"]
  };

  const prompt = `Analyze this resume against the job description and provide optimization suggestions.

RULES:
1. Copy EXACT text for "original" fields - no paraphrasing
2. Provide 3-5 bullet_improvements from Experience section with original, improved, issue, rationale
3. Provide 4-6 gap_analysis items identifying MISSING requirements from job description
4. match_score = sum of category scores (hard_skills + experience + education + soft_skills)
5. gap_analysis should identify what the resume LACKS compared to the job requirements

PROJECT IMPROVEMENTS (REQUIRED - do not leave empty):
6. Look for any Projects section in the resume. If found, provide 1-3 project_improvements to reframe them for this job.
   - project_name: The actual name of the project from the resume
   - original: The current project description text
   - improved: Rewritten description highlighting relevance to the job
   - issue: What's wrong with the current description
   - rationale: Why the improvement helps
   If no projects section exists, create 1 suggestion with project_name="No Projects Found", original="N/A", improved="Consider adding a Projects section showcasing relevant work", issue="Missing projects section", rationale="Projects demonstrate practical skills"

CERTIFICATION RECOMMENDATIONS (REQUIRED - do not leave empty):
7. Based on the job requirements, recommend 1-2 certifications the candidate should obtain.
   - name: Full certification name (e.g., "AWS Solutions Architect Associate")
   - issuer: Organization that issues it (e.g., "Amazon Web Services")
   - relevance: Why this certification matters for this specific job

GAP ANALYSIS FORMAT - Each gap MUST have:
- requirement: What the job requires (e.g., "5+ years Python experience")
- current_state: What the resume shows (e.g., "2 years Python mentioned")
- gap_severity: "critical", "moderate", or "minor"
- recommendation: Specific action to address the gap

JOB DESCRIPTION:
${jobDescription}

RESUME:
${resumeText}`;

  try {
    console.log(`[OpenRouter] Optimizing with ${MODELS.flash}`);
    const messages = [{ role: 'user', content: prompt }];
    // Use 70s timeout for optimize (function has 75s Netlify timeout)
    const text = await callOpenRouter('flash', messages, schema, {
      maxTokens: 16384,
      timeoutMs: 70000
    });
    console.log(`[OpenRouter] Optimize response length: ${text.length} chars`);

    let parsed;
    try { parsed = JSON.parse(text); }
    catch { parsed = sanitizeAndParseJSON(text); }
    return parsed;
  } catch (error) {
    console.error("[OpenRouter] Error in optimizeResume:", error);
    throw error;
  }
}

/**
 * Fast match-only analysis - lightweight prompt for quick scoring.
 * Returns only essential match data without detailed improvements.
 * @param {string} resumeText - Plain text resume content.
 * @param {string} jobDescription - Job description text.
 * @returns {Promise<object>} - Match score, keywords, and reasoning.
 */
export async function processMatchOnly(resumeText, jobDescription) {
  console.log(`[Gemini] Fast match analysis with ${MODELS.flash}`);

  const schema = {
    type: "object",
    properties: {
      score: { type: "number" },
      categoryScores: CATEGORY_SCORE_SCHEMA,
      strongMatches: { type: "array", items: { type: "string" } },
      missingKeywords: { type: "array", items: { type: "string" } },
      reasoning: { type: "string" }
    },
    required: ["score", "categoryScores", "strongMatches", "missingKeywords", "reasoning"]
  };

  const prompt = `Analyze this resume against the job description. Calculate score as: hard_skills (0-40) + experience (0-30) + education (0-15) + soft_skills (0-15).

Job Description:
${jobDescription}

Resume:
${resumeText}`;

  try {
    const messages = [{ role: 'user', content: prompt }];
    // Use 40s timeout for ai-match (function has 45s Netlify timeout)
    const text = await callOpenRouter('flash', messages, schema, {
      maxTokens: 16384,
      timeoutMs: 40000
    });
    console.log(`[OpenRouter] Match response: ${text.length} chars`);

    let parsed;
    try { parsed = JSON.parse(text); }
    catch { parsed = sanitizeAndParseJSON(text); }

    return {
      score: parsed.score || 50,
      categoryScores: parsed.categoryScores || null,
      strongMatches: parsed.strongMatches || [],
      missingKeywords: parsed.missingKeywords || [],
      reasoning: parsed.reasoning || "Unable to determine match score."
    };
  } catch (error) {
    console.error("[Gemini] Error in fast match analysis:", error);
    throw error;
  }
}

/**
 * Predicts interview questions based on resume and job description.
 * Uses structured output for reliable extraction.
 * @param {string} resumeText - Plain text resume content.
 * @param {string} jobDescription - Job description text.
 * @returns {Promise<object>} - Interview prep data with questions and focus areas.
 */
export async function predictInterviewQuestions(resumeText, jobDescription) {
  console.log(`[Gemini] Predicting interview questions with ${MODELS.lite}`);

  const schema = {
    type: "object",
    properties: {
      predicted_questions: {
        type: "array",
        items: { type: "string" }
      },
      role_level: { type: "string" },
      focus_areas: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: ["predicted_questions", "role_level", "focus_areas"]
  };

  const prompt = `You are an expert interviewer. Based on the resume and job description below, generate interview questions.

INSTRUCTIONS:
1. Generate 8-12 likely interview questions the candidate might face
2. Include a mix of:
   - Behavioral questions (STAR format triggers)
   - Technical questions based on required skills
   - Experience-based questions about their background
   - Role-specific situational questions
3. Identify the role level (e.g., "Junior", "Mid-level", "Senior", "Lead", "Executive")
4. List 3-5 key focus areas the interview will likely cover

JOB DESCRIPTION:
${jobDescription}

RESUME:
${resumeText}`;

  try {
    const messages = [{ role: 'user', content: prompt }];
    const text = await callOpenRouter('lite', messages, schema, { temperature: 0.3, maxTokens: 4096 });
    console.log(`[OpenRouter] Interview prep response: ${text.length} chars`);

    let parsed;
    try { parsed = JSON.parse(text); }
    catch { parsed = sanitizeAndParseJSON(text); }

    return {
      predicted_questions: parsed.predicted_questions || [],
      role_level: parsed.role_level || "Unknown",
      focus_areas: parsed.focus_areas || []
    };
  } catch (error) {
    console.error("[OpenRouter] Error predicting interview questions:", error);
    throw error;
  }
}

/**
 * Generates a professional cover letter based on resume and job description.
 * @param {string} resumeText - Plain text resume content.
 * @param {string} jobDescription - Job description text.
 * @returns {Promise<{ draft_text: string }>} - Generated cover letter.
 */
export async function generateCoverLetter(resumeText, jobDescription) {
  console.log(`[Gemini] Generating cover letter with ${MODELS.flash}`);

  const schema = {
    type: "object",
    properties: {
      draft_text: { type: "string" }
    },
    required: ["draft_text"]
  };

  const prompt = `Write a professional cover letter based on the resume and job description below.

RULES:
1. Address it to "Hiring Manager" unless a specific name is in the job description
2. Keep it concise (3-4 paragraphs max)
3. Highlight relevant skills and experience from the resume that match the job requirements
4. Use a professional but engaging tone
5. Include a strong opening and compelling closing
6. Do NOT include placeholder text like [Your Name] - use actual details from the resume

JOB DESCRIPTION:
${jobDescription}

RESUME:
${resumeText}

Return ONLY the cover letter text in the draft_text field.
7. CRITICAL: Use double newlines (\n\n) to separate paragraphs. Do NOT write a single block of text.`;

  try {
    const messages = [{ role: 'user', content: prompt }];
    const text = await callOpenRouter('flash', messages, schema, { maxTokens: 16384 });
    console.log(`[OpenRouter] Cover letter response: ${text.length} chars`);

    let parsed;
    try { parsed = JSON.parse(text); }
    catch { parsed = sanitizeAndParseJSON(text); }

    return { draft_text: parsed.draft_text || "" };
  } catch (error) {
    console.error("[OpenRouter] Error generating cover letter:", error);
    throw error;
  }
}
