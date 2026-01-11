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
  temperature: 0,  // Deterministic output - no randomness
  topP: 0.95,      // Slightly more focused (was 1)
  topK: 1,         // Greedy decoding - always pick the most likely token
  maxOutputTokens: 4096,  // Balanced for most use cases (reduced from 8192 to prevent timeouts)
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

    // Concise prompt - JSON Schema Mode handles structure validation
    const prompt = `
Analyze this resume against the job description below.

Job Description:
${jobDescription}

Instructions:
1. Parse the resume into JSON Resume format (jsonresume.org)
2. Provide optimization suggestions in meta.ai_suggestions:
   - GAP ANALYSIS: 3-5 items showing JD requirements vs resume (severity-ordered)
   - KEYWORD STRATEGY: mirrored_phrases (3-8 exact JD phrases), structural_changes, hidden_matches
   - BULLET IMPROVEMENTS: Top 3-5 bullets with original (exact text), improved, issue, rationale
   - HEADLINE/SUMMARY: original (exact) + suggested versions
   - CATEGORY SCORES: hard_skills (0-40), experience (0-30), education (0-10), soft_skills (0-20) - must sum to match_score
   - MATCH SCORE: Precise number (e.g., 73, 88) - avoid round numbers
3. Use EXACT original text for all "original_*" fields (critical for fuzzy matching)
4. Map all Experience sections to "work" array with highlights
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

    // Define JSON schema for structured output
    const responseJsonSchema = {
      type: "object",
      properties: {
        basics: {
          type: "object",
          properties: {
            name: { type: "string" },
            label: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            summary: { type: "string" },
            location: {
              type: "object",
              properties: {
                city: { type: "string" },
                countryCode: { type: "string" },
                region: { type: "string" }
              }
            },
            profiles: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  network: { type: "string" },
                  url: { type: "string" }
                }
              }
            }
          }
        },
        work: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              position: { type: "string" },
              location: { type: "string" },
              startDate: { type: "string" },
              endDate: { type: "string" },
              highlights: { type: "array", items: { type: "string" } }
            }
          }
        },
        education: {
          type: "array",
          items: {
            type: "object",
            properties: {
              institution: { type: "string" },
              area: { type: "string" },
              studyType: { type: "string" },
              startDate: { type: "string" },
              endDate: { type: "string" }
            }
          }
        },
        skills: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              keywords: { type: "array", items: { type: "string" } }
            }
          }
        },
        projects: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              highlights: { type: "array", items: { type: "string" } },
              keywords: { type: "array", items: { type: "string" } }
            }
          }
        },
        certificates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              date: { type: "string" },
              issuer: { type: "string" }
            }
          }
        },
        meta: {
          type: "object",
          properties: {
            version: { type: "string" },
            match_score: { type: "number" },
            ai_suggestions: {
              type: "object",
              properties: {
                original_headline: { type: "string" },
                suggested_headline: { type: "string" },
                original_summary: { type: "string" },
                summary_rewrite: { type: "string" },
                bullet_improvements: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      original: { type: "string" },
                      improved: { type: "string" },
                      issue: { type: "string" },
                      rationale: { type: "string" }
                    },
                    required: ["original", "improved", "issue", "rationale"]
                  }
                },
                gap_analysis: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      requirement: { type: "string" },
                      current_state: { type: "string" },
                      gap_severity: { type: "string", enum: ["critical", "moderate", "minor"] },
                      recommendation: { type: "string" }
                    },
                    required: ["requirement", "current_state", "gap_severity", "recommendation"]
                  }
                },
                keyword_strategy: {
                  type: "object",
                  properties: {
                    mirrored_phrases: { type: "array", items: { type: "string" } },
                    structural_changes: { type: "array", items: { type: "string" } },
                    hidden_matches: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          resume_term: { type: "string" },
                          jd_requirement: { type: "string" },
                          insight: { type: "string" }
                        }
                      }
                    }
                  }
                },
                category_scores: {
                  type: "object",
                  properties: {
                    hard_skills: {
                      type: "object",
                      properties: {
                        score: { type: "number" },
                        max: { type: "number" },
                        reasoning: { type: "string" }
                      }
                    },
                    experience: {
                      type: "object",
                      properties: {
                        score: { type: "number" },
                        max: { type: "number" },
                        reasoning: { type: "string" }
                      }
                    },
                    education: {
                      type: "object",
                      properties: {
                        score: { type: "number" },
                        max: { type: "number" },
                        reasoning: { type: "string" }
                      }
                    },
                    soft_skills: {
                      type: "object",
                      properties: {
                        score: { type: "number" },
                        max: { type: "number" },
                        reasoning: { type: "string" }
                      }
                    }
                  }
                },
                score_breakdown: {
                  type: "object",
                  properties: {
                    base_score: { type: "number" },
                    bonuses: { type: "number" },
                    penalties: { type: "number" },
                    final_score: { type: "number" }
                  }
                },
                reasoning: { type: "string" },
                missing_keywords: { type: "array", items: { type: "string" } },
                keywords_to_keep: { type: "array", items: { type: "string" } },
                keywords_to_avoid: { type: "array", items: { type: "string" } }
              },
              required: ["gap_analysis", "keyword_strategy", "bullet_improvements", "category_scores", "reasoning"]
            }
          },
          required: ["ai_suggestions", "match_score"]
        }
      },
      required: ["basics", "work", "meta"]
    };

    // Use JSON Schema Mode for guaranteed valid structure
    const result = await selectedModel.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: {
        ...generationConfig,
        responseMimeType: "application/json",
        responseSchema: responseJsonSchema
      }
    });

    const response = await result.response;
    const text = response.text();

    // With JSON Schema Mode, response should be valid JSON, but we still need fallback
    // for edge cases like truncation or network issues
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (jsonError) {
      console.warn('[Gemini] JSON Schema Mode returned invalid JSON, attempting repair...', jsonError.message);
      // Fall back to the robust sanitization function that can handle truncated JSON
      parsed = sanitizeAndParseJSON(text);
    }

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
 * Optimizes a resume against a job description using Gemini.
 * Focused function for generating optimization suggestions only.
 * @param {string} resumeText - Plain text resume content.
 * @param {string} jobDescription - Job description text.
 * @returns {Promise<object>} - Optimization suggestions with original and improved content.
 */
export async function optimizeResume(resumeText, jobDescription) {
  const selectedModel = getModel('flash');

  const prompt = `
You are an expert resume optimizer. Analyze this resume against the job description.

## JOB DESCRIPTION:
${jobDescription}

## RESUME:
${resumeText}

## CRITICAL RULES:
1. For ALL "original" fields: COPY THE EXACT TEXT from the resume - NO paraphrasing
2. For "improved" fields: Your enhanced version with metrics/action verbs
3. Return ONLY the JSON structure below - no markdown, no explanations

## REQUIRED OUTPUT:
{
  "original_headline": "<exact headline from resume or empty string>",
  "suggested_headline": "<your improved headline aligned with JD>",
  "original_summary": "<exact summary from resume or empty string>",
  "summary_rewrite": "<your improved summary>",
  "bullet_improvements": [
    {
      "original": "<EXACT bullet text from resume>",
      "improved": "<your enhanced version>",
      "issue": "<what's weak>",
      "rationale": "<why yours is better>"
    }
  ],
  "missing_keywords": ["<keyword1>", "<keyword2>"],
  "keywords_to_keep": ["<keyword1>", "<keyword2>"],
  "keywords_to_avoid": ["<keyword1>", "<keyword2>"]
}

Provide 3-5 bullet improvements. Focus on the weakest bullets first.
`;

  try {
    const result = await selectedModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 2048,  // Reduced for speed
        topP: 0.95,
        topK: 1,
      }
    });

    return sanitizeAndParseJSON(result.response.text());
  } catch (error) {
    console.error("[Gemini] Error in optimizeResume:", error);
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
  "score": <number 0-100, precise like 73, 41, 88 - avoid round numbers>,
  "categoryScores": {
    "hard_skills": {"score": <0-40>, "max": 40, "reasoning": "<brief>"},
    "experience": {"score": <0-30>, "max": 30, "reasoning": "<brief>"},
    "education": {"score": <0-15>, "max": 15, "reasoning": "<brief>"},
    "soft_skills": {"score": <0-15>, "max": 15, "reasoning": "<brief>"}
  },
  "strongMatches": [<up to 10 skills/keywords matching JD>],
  "missingKeywords": [<up to 10 missing skills/keywords>],
  "reasoning": "<1-2 sentences explaining overall score>"
}

SCORING WEIGHTS (must sum to overall score):
- hard_skills (40%): Technical skills alignment
- experience (30%): Relevant experience and impact
- education (15%): Degree/certification match
- soft_skills (15%): Communication, leadership evidence

Calculate overall score as:
score = hard_skills.score + experience.score + education.score + soft_skills.score

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
