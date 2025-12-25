import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("Error: GEMINI_API_KEY is not set.");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");
const MODEL_NAME = "gemini-2.5-flash-lite";

const model = genAI.getGenerativeModel({
  model: MODEL_NAME,
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0,  // Deterministic output - no randomness
    topP: 1,         // No nucleus sampling
    topK: 1,         // Greedy decoding - always pick the most likely token
  },
});

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
 * Processes a resume against a job description using Gemini Flash 2.5.
 * Returns JSON Resume format with AI optimization metadata.
 * @param {string} inputData - Base64 encoded PDF data OR plain text resume.
 * @param {string} jobDescription - Job description text.
 * @param {boolean} isPdf - True if inputData is base64 PDF, false if text.
 * @returns {Promise<object>} - JSON Resume schema with meta.ai_suggestions.
 */
export async function processResume(inputData, jobDescription, isPdf = true) {
  try {
    console.log(`[Gemini] Processing resume with ${MODEL_NAME}. Input type: ${isPdf ? "PDF" : "Text"}`);

    const prompt = `
Job Description:
${jobDescription}

Analyze the provided resume against this job description.
You MUST output JSON strictly adhering to the JSONResume.org schema.

Return the response in the following JSON Resume format:
{
  "basics": {
    "name": "string",
    "label": "string (Job Title / Professional Headline)",
    "email": "string",
    "phone": "string",
    "url": "string (optional, personal website)",
    "summary": "string (professional summary)",
    "location": {
      "city": "string",
      "countryCode": "string (ISO 3166-1 alpha-2)",
      "region": "string (state/province)"
    },
    "profiles": [{ "network": "string", "username": "string", "url": "string" }]
  },
  "work": [
    {
      "name": "string (Company name)",
      "position": "string (Job title)",
      "url": "string (optional, company website)",
      "location": "string (City, State/Region - extract if present in resume)",
      "startDate": "string (YYYY-MM-DD or YYYY-MM)",
      "endDate": "string (YYYY-MM-DD, YYYY-MM, or 'Present')",
      "summary": "string (role description)",
      "highlights": ["string (bullet point achievements)"]
    }
  ],
  "education": [
    {
      "institution": "string",
      "url": "string (optional)",
      "area": "string (Major / Field of study)",
      "studyType": "string (Degree type: Bachelor, Master, PhD, Diploma, etc.)",
      "startDate": "string",
      "endDate": "string",
      "score": "string (optional, GPA)",
      "courses": ["string (optional, relevant coursework)"],
      "highlights": ["string (achievements, year-by-year details like 'First Year: coursework focused on...', 'Second Year: hands-on workshops...')"]
    }
  ],
  "skills": [
    {
      "name": "string (Category: Frontend, Backend, DevOps, etc.)",
      "level": "string (optional: Expert, Intermediate, Beginner)",
      "keywords": ["string (individual skills: React, TypeScript, etc.)"]
    }
  ],
  "projects": [
    {
      "name": "string (REQUIRED - The actual descriptive project title from resume. NEVER use generic 'Project' or 'Project 1'. Extract the real name like 'Automated Inventory Tracker', 'Market Research Initiative', etc.)",
      "description": "string (Brief 1-2 sentence summary, separate from name)",
      "highlights": ["string (bullet point achievements - do not duplicate description)"],
      "keywords": ["string (technologies used)"],
      "url": "string (optional)"
    }
  ],
  "certificates": [
    {
      "name": "string",
      "date": "string",
      "issuer": "string",
      "url": "string (optional)"
    }
  ],
  "languages": [
    {
      "language": "string",
      "fluency": "string (Native, Fluent, Intermediate, Basic)"
    }
  ],
  "meta": {
    "version": "1.0.0",
    "lastModified": "string (ISO 8601 date)",
    "match_score": "number (0-100, job match score - BE PRECISE, use specific numbers like 73, 41, 88, 56 - AVOID round numbers like 50, 60, 70, 80, 85, 90, 100)",
    "ai_suggestions": {
      "original_headline": "string (REQUIRED - extract the EXACT current headline from resume)",
      "suggested_headline": "string (REQUIRED - optimized headline tailored for this specific job)",
      "original_summary": "string (REQUIRED - extract the EXACT current summary from resume)",
      "summary_rewrite": "string (REQUIRED - action-oriented rewrite targeting the job)",
      "reasoning": "string (2-3 sentences explaining WHY this exact match score was given - cite specific matching skills and experience that contribute positively and specific gaps that reduce the score)",
      "missing_keywords": ["string (skills to add)"],
      "hard_skills_gap": ["string (technical gaps)"],
      "keywords_to_keep": ["string (strong matches)"],
      "keywords_to_avoid": ["string (clichés to remove)"],
      "bullet_improvements": [{
        "work_index": "number (index in work array)",
        "highlight_index": "number (index in highlights array)",
        "original": "string (REQUIRED - the EXACT original bullet text from resume)",
        "improved": "string (REQUIRED - the improved version with metrics and action verbs)",
        "issue": "string (e.g. 'Passive voice', 'Lack of metrics')",
        "rationale": "string"
      }],
      "education_improvements": [{
        "education_index": "number",
        "original": "string (REQUIRED - exact original text)",
        "improved": "string (REQUIRED - improved version)",
        "issue": "string",
        "rationale": "string"
      }],
      "project_improvements": [{
        "project_index": "number",
        "original": "string (REQUIRED - exact original text)",
        "improved": "string (REQUIRED - improved version)",
        "issue": "string",
        "rationale": "string"
      }]
    },
    "interview_prep": {
      "predicted_questions": ["string"],
      "role_level": "string (Junior, Mid, Senior, Lead)",
      "focus_areas": ["string (System Design, Algorithms, etc.)"]
    },
    "cover_letter_draft": "string"
  }
}

CRITICAL REQUIREMENTS:
- Map ALL experience entries to "work" array with "highlights" for bullet points
- Map ALL education entries to "education" array
- Categorize skills into logical groups in "skills" array
- Store AI optimizations ONLY in "meta.ai_suggestions" to preserve standard schema
- ALWAYS populate "original" fields with EXACT text from resume
- ALWAYS populate "improved" fields with your enhanced version
- NEVER leave original or improved fields empty - if no improvement needed, copy original to improved
- Provide at least 3-5 bullet_improvements suggestions
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

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
    });

    const response = await result.response;
    const text = response.text();
    const parsed = JSON.parse(text);

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
        keywordsToKeep: parsed.meta.ai_suggestions.keywords_to_keep || []
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
    console.log(`[Gemini] Parsing resume with ${MODEL_NAME}. Input type: ${isPdf ? "PDF" : "Text"}`);

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
     (e.g., "First Year: Focused on academic coursework...", "Second Year: Hands-on workshop courses...")
   - courses: Array of relevant coursework if mentioned

3. PROJECTS - For each project:
   - name: Project name
   - description: Brief description
   - highlights: Array of ALL bullet points
   - keywords: Technologies used

4. SKILLS - Group by category if present:
   - Technical Skills, Programming Languages, Soft Skills, etc.
   Each group should have name and keywords array.

5. CERTIFICATIONS - Extract all certifications with:
   - name: Certificate name
   - issuer: Issuing organization
   - date: Date obtained

6. LANGUAGES - Extract language proficiencies

DO NOT OMIT any bullet points or details. Include EVERY piece of information from the resume.
Location is REQUIRED for each work entry if mentioned in the resume.
Education highlights (bullet points describing coursework/achievements) are REQUIRED if present.`;

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
    const parsed = JSON.parse(text);

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
      throw new Error(`Model error: The model '${MODEL_NAME}' may not be available. Please check the model name.`);
    }

    throw error;
  }
}
