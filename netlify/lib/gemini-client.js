import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("Error: GEMINI_API_KEY is not set.");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");

// Dual model configuration
const MODELS = {
  lite: "gemini-2.5-flash-lite",  // Fast, lower cost - for parsing
  flash: "gemini-2.5-flash"       // Higher quality - for matching/optimization
};

const generationConfig = {
  // Removed responseMimeType - JSON mode has hidden length constraints that cause truncation
  // Instead, we'll request JSON in markdown code blocks for longer responses
  temperature: 0,  // Deterministic output - no randomness
  topP: 0.95,      // Slightly more focused (was 1)
  topK: 1,         // Greedy decoding - always pick the most likely token
  maxOutputTokens: 8192,  // Increased to allow complete JSON responses (was 4096, caused truncation)
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

    // If we found a valid end point, truncate there
    if (lastValidEnd > 0 && lastValidEnd < cleaned.length - 1) {
      console.warn(`[Gemini] Truncating at position ${lastValidEnd} to find valid JSON end`);
      cleaned = cleaned.substring(0, lastValidEnd + 1);
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

    // If we're still in a string, close it
    if (inString) {
      cleaned += '"';
      // Remove trailing incomplete property after closing the string
      // This handles cases like: "url": "https://incomplete
      cleaned = cleaned.replace(/,?\s*"[^"]*":\s*"[^"]*"\s*$/g, (match) => {
        // Only remove if it looks incomplete (doesn't end with proper structure)
        return match;
      });
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
      } catch (e) {
        // Ignore extraction errors
      }

      console.error('[Gemini] JSON sanitization failed. Raw text preview:', text.substring(0, 500));
      throw new Error(`Failed to parse AI response: ${secondError.message}. Response preview: ${text.substring(0, 200)}...`);
    }
  }
}

/**
 * Get a Gemini model instance by type
 * @param {'lite' | 'flash'} modelType - Model type to use
 * @returns {object} - Gemini model instance
 */
function getModel(modelType = 'lite') {
  const modelName = MODELS[modelType] || MODELS.lite;
  console.log(`[Gemini] Using model: ${modelName}`);
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig,
  });
}

// Default model for backwards compatibility
const model = getModel('lite');

/**
 * JSON Resume Schema System Prompt
 * Enforces strict adherence to https://jsonresume.org/schema
 */
const JSON_RESUME_SYSTEM_PROMPT = `You are a strict ATS (Applicant Tracking System) parser.
You MUST output JSON strictly adhering to the JSONResume.org schema standard.

CRITICAL MAPPING RULES:
- "Experience" sections MUST map to "work" array
- Bullet points MUST map to "work[].highlights" array
- "Education" sections MUST map to "education" array
- "Skills" MUST map to "skills" array with categorized keywords
- Contact information MUST map to "basics" object
- Projects MUST map to "projects" array

AI optimization suggestions should be stored in "meta.ai_suggestions" to preserve schema integrity.`;

/**
 * Processes a resume against a job description using Gemini.
 * Returns JSON Resume format with AI optimization metadata.
 * @param {string} inputData - Base64 encoded PDF data OR plain text resume.
 * @param {string} jobDescription - Job description text.
 * @param {boolean} isPdf - True if inputData is base64 PDF, false if text.
 * @param {'lite' | 'flash'} modelType - Model to use: 'lite' for fast/cheap, 'flash' for quality.
 * @returns {Promise<object>} - JSON Resume schema with meta.ai_suggestions.
 */
export async function processResume(inputData, jobDescription, isPdf = true, modelType = 'flash') {
  const selectedModel = getModel(modelType);
  try {
    console.log(`[Gemini] Processing resume with ${MODELS[modelType]}. Input type: ${isPdf ? "PDF" : "Text"}`);

    // OPTIMIZED PROMPT: Reduced from 238 lines to ~120 lines for faster processing
    const prompt = `
CRITICAL INSTRUCTION: Return ONLY valid JSON wrapped in markdown code blocks like this:

\`\`\`json
{
  "basics": {...},
  "work": [...],
  "meta": {"ai_suggestions": {...}}
}
\`\`\`

Do not include explanatory text before or after the JSON.

Job Description:
${jobDescription}

OUTPUT: JSON Resume schema (jsonresume.org) with the resume content plus AI optimization metadata in meta.ai_suggestions.

CRITICAL ANALYSIS REQUIREMENTS:

1. GAP ANALYSIS (REQUIRED - minimum 5 items, severity-ordered):
   CRITICAL: You MUST generate at least 5 gap analysis items. Do not return an empty array.
   Example: {"requirement": "3+ years experience with React", "current_state": "2 years React mentioned", "gap_severity": "moderate", "recommendation": "Highlight JavaScript framework experience to bridge gap"}
   - requirement: Exact JD phrase requiring something
   - current_state: What the resume currently shows
   - gap_severity: critical|moderate|minor (ordered by importance)
   - recommendation: Specific actionable advice

2. KEYWORD STRATEGY:
   - mirrored_phrases: 5-10 exact JD phrases used in optimizations
   - structural_changes: 2-4 reorganization decisions with rationale
   - hidden_matches: Resume skills mapping to JD (different terminology)

3. CATEGORY SCORING (must sum to match_score):
   hard_skills (0-40): Technical skill alignment
   experience (0-30): Relevance & impact
   education (0-10): Degree/cert match
   soft_skills (0-20): Communication/leadership evidence

4. OPTIMIZATIONS (3-5 minimum):
   - bullet_improvements: [{work_index, highlight_index, original, improved, issue, rationale}]
   - original_headline & suggested_headline (EXACT text required)
   - original_summary & summary_rewrite (EXACT text required)
   - education_improvements, project_improvements (if applicable)

MATCH SCORE RULES:
- Use precise numbers (73, 41, 88) - avoid round numbers (50, 60, 70, 80, 90)
- Provide reasoning citing specific skills/gaps
- Include score_breakdown showing calculation

SCHEMA: JSON Resume (jsonresume.org) with meta.ai_suggestions containing:
- original_headline/suggested_headline, original_summary/summary_rewrite (EXACT current text required)
- reasoning, missing_keywords, keywords_to_keep/avoid
- bullet_improvements[{work_index, highlight_index, original, improved, issue, rationale}]
- gap_analysis[] (5-10 items), keyword_strategy{mirrored_phrases, structural_changes, hidden_matches}
- category_scores{hard_skills, experience, education, soft_skills} (must sum to match_score)
- score_breakdown{base_score, bonuses, penalties, final_score, explanation}

Map experience→"work" with highlights[]. Use real project names. Never leave original/improved empty.
`;

    const parts = [
      { text: JSON_RESUME_SYSTEM_PROMPT },
      { text: prompt }
    ];

    if (isPdf) {
      parts.push({
        inlineData: {
          mimeType: "application/pdf",
          data: inputData,
        },
      });
    } else {
      parts.push({ text: `RESUME CONTENT:\n${inputData}` });
    }

    const result = await selectedModel.generateContent({
      contents: [{ role: "user", parts }],
    });

    const response = await result.response;
    const text = response.text();
    const parsed = sanitizeAndParseJSON(text);

    // Backwards compatibility: also expose optimization in legacy format
    if (parsed.meta?.ai_suggestions) {
      parsed.optimization = {
        original_headline: parsed.meta.ai_suggestions.original_headline,
        suggested_headline: parsed.meta.ai_suggestions.suggested_headline,
        original_summary: parsed.meta.ai_suggestions.original_summary,
        summary_rewrite: parsed.meta.ai_suggestions.summary_rewrite,
        skills_gap_analysis: {
          missing_keywords_to_add: parsed.meta.ai_suggestions.missing_keywords || [],
          irrelevant_skills_to_remove: parsed.meta.ai_suggestions.keywords_to_avoid || []
        },
        bullet_point_improvements: (parsed.meta.ai_suggestions.bullet_improvements || []).map(b => ({
          original: b.original,
          improved: b.improved,
          issue: b.issue,
          rationale: b.rationale
        })),
        education_improvements: (parsed.meta.ai_suggestions.education_improvements || []).map(e => ({
          degree: parsed.education?.[e.education_index]?.studyType || "",
          original: e.original,
          improved: e.improved,
          issue: e.issue,
          rationale: e.rationale
        })),
        projects_improvements: (parsed.meta.ai_suggestions.project_improvements || []).map(p => ({
          project_name: parsed.projects?.[p.project_index]?.name || "",
          original: p.original,
          improved: p.improved,
          issue: p.issue,
          rationale: p.rationale
        })),
        keywords_to_keep: parsed.meta.ai_suggestions.keywords_to_keep || [],
        keywords_to_avoid: parsed.meta.ai_suggestions.keywords_to_avoid || []
      };
      parsed.matchAnalysis = {
        score_0_to_100: parsed.meta.match_score,
        reasoning: parsed.meta.ai_suggestions.reasoning,
        missingKeywords: parsed.meta.ai_suggestions.missing_keywords || [],
        hardSkillsGap: parsed.meta.ai_suggestions.hard_skills_gap || [],
        keywordsToKeep: parsed.meta.ai_suggestions.keywords_to_keep || [],
        categoryScores: parsed.meta.ai_suggestions.category_scores || null,
        // Gap analysis - map from snake_case to camelCase
        gapAnalysis: (parsed.meta.ai_suggestions.gap_analysis || []).map(g => ({
          requirement: g.requirement,
          currentState: g.current_state,
          severity: g.gap_severity,
          recommendation: g.recommendation
        })),
        // Keyword strategy - map from snake_case to camelCase
        keywordStrategy: parsed.meta.ai_suggestions.keyword_strategy ? {
          mirroredPhrases: parsed.meta.ai_suggestions.keyword_strategy.mirrored_phrases || [],
          structuralChanges: parsed.meta.ai_suggestions.keyword_strategy.structural_changes || [],
          hiddenMatches: (parsed.meta.ai_suggestions.keyword_strategy.hidden_matches || []).map(h => ({
            resumeTerm: h.resume_term,
            jdRequirement: h.jd_requirement,
            insight: h.insight
          }))
        } : null
      };
      parsed.candidateProfile = {
        name: parsed.basics?.name || "",
        email: parsed.basics?.email || "",
        skills: (parsed.skills || []).flatMap(s => s.keywords || [])
      };
      parsed.interviewPrep = parsed.meta.interview_prep ? {
        predicted_questions: parsed.meta.interview_prep.predicted_questions || [],
        roleLevel: parsed.meta.interview_prep.role_level || "",
        focusAreas: parsed.meta.interview_prep.focus_areas || []
      } : undefined;
      parsed.coverLetter = parsed.meta.cover_letter_draft ? {
        draft_text: parsed.meta.cover_letter_draft
      } : undefined;
    }

    return parsed;

  } catch (error) {
    console.error("[Gemini] Error processing resume:", error);
    throw error;
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
  try {
    console.log(`[Gemini] Parsing resume with ${MODELS.lite}. Input type: ${isPdf ? "PDF" : "Text"}`);

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

    const parts = [
      { text: systemInstruction },
      { text: prompt }
    ];

    if (isPdf) {
      parts.push({
        inlineData: {
          mimeType: "application/pdf",
          data: inputData,
        },
      });
    } else {
      parts.push({ text: `RESUME CONTENT:\n${inputData}` });
    }

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
    });

    const response = await result.response;
    const text = response.text();
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
    parsed.summary = parsed.basics?.summary || "";
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
    console.error("[Gemini] Error parsing resume:", error);

    // Provide more specific error messages
    if (!API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured. Please set the environment variable.");
    }

    if (error instanceof SyntaxError) {
      throw new Error("Failed to parse AI response as JSON. The AI may have returned invalid data.");
    }

    // Preserve and enrich the original error message
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("API_KEY") || errorMessage.includes("permission") || errorMessage.includes("403")) {
      throw new Error("API key error: Please verify your GEMINI_API_KEY is valid and has proper permissions.");
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
 * Fast match-only analysis - lightweight prompt for quick scoring.
 * Returns only essential match data without detailed improvements.
 * @param {string} resumeText - Plain text resume content.
 * @param {string} jobDescription - Job description text.
 * @returns {Promise<object>} - Match score, keywords, and reasoning.
 */
export async function processMatchOnly(resumeText, jobDescription) {
  const selectedModel = getModel('flash');
  try {
    console.log(`[Gemini] Fast match analysis with ${MODELS.flash}`);

    const prompt = `
Analyze this resume against the job description and return a match score.

Job Description:
${jobDescription}

Resume:
${resumeText}

Return ONLY this JSON structure (no other text):
{
  "score": <number 0-100, be precise like 73, 41, 88 - avoid round numbers>,
  "strongMatches": [<up to 10 skills/keywords from resume that match JD requirements>],
  "missingKeywords": [<up to 10 important skills/keywords from JD missing in resume>],
  "reasoning": "<1-2 sentences explaining the score>"
}

SCORING GUIDE:
- 80-100: Strong match - most required skills present, relevant experience
- 60-79: Good match - core skills present, some gaps
- 40-59: Partial match - transferable skills, significant gaps
- 0-39: Weak match - few relevant skills/experience

Be specific and precise. Focus on the most important requirements.`;

    const result = await selectedModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const response = await result.response;
    const text = response.text();
    const parsed = sanitizeAndParseJSON(text);

    // Ensure all fields exist with defaults
    return {
      score: parsed.score || 50,
      strongMatches: parsed.strongMatches || [],
      missingKeywords: parsed.missingKeywords || [],
      reasoning: parsed.reasoning || "Unable to determine match score."
    };

  } catch (error) {
    console.error("[Gemini] Error in fast match analysis:", error);
    throw error;
  }
}
