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
    },
});

/**
 * Processes a resume against a job description using Gemini Flash 2.5.
 * @param {string} inputData - Base64 encoded PDF data OR plain text resume.
 * @param {string} jobDescription - Job description text.
 * @param {boolean} isPdf - True if inputData is base64 PDF, false if text.
 * @returns {Promise<object>} - Structured JSON analysis.
 */
export async function processResume(inputData, jobDescription, isPdf = true) {
    try {
        console.log(`[Gemini] Processing resume with ${MODEL_NAME}. Input type: ${isPdf ? "PDF" : "Text"}`);

        const systemInstruction = "You are a strict ATS (Applicant Tracking System) parser. Analyze the candidate objectively.";

        const prompt = `
      Job Description:
      ${jobDescription}

      Please analyze the provided resume against this job description.
      
      Return the response in the following JSON format:
      {
        "candidateProfile": { "name": "string", "email": "string", "skills": ["string"] },
        "matchAnalysis": { 
          "score_0_to_100": "number", 
          "reasoning": "string (short summary of why this score)",
          "missingKeywords": ["string"], 
          "hardSkillsGap": ["string"] 
        },
        "optimization": { 
          "original_headline": "string (The extracted current headline/title from resume)",
          "suggested_headline": "string (REWRITE title to match JD)",
          "original_summary": "string (The extracted current professional summary)",
          "summary_rewrite": "string (action-oriented)",
          "skills_gap_analysis": {
             "missing_keywords_to_add": ["string"],
             "irrelevant_skills_to_remove": ["string"]
          },
          "bullet_point_improvements": [{ 
            "original": "string", 
            "improved": "string",
            "issue": "string (specific critique, e.g. 'Passive voice', 'Lack of metrics')",
            "rationale": "string (why the improvement is better)"
          }],
          "education_improvements": [{
            "degree": "string",
            "original": "string",
            "improved": "string",
            "issue": "string",
            "rationale": "string"
          }],
          "projects_improvements": [{
            "project_name": "string",
            "original": "string",
            "improved": "string",
            "issue": "string",
            "rationale": "string"
          }],
          "keywords_to_keep": ["string (strong matches found in resume)"],
          "keywords_to_avoid": ["string (clichés or irrelevant terms to remove)"]
        },
        "interviewPrep": { 
          "predicted_questions": ["string"],
          "roleLevel": "string (Junior, Mid, Senior, Lead, etc.)",
          "focusAreas": ["string (e.g. System Design, Algorithms, Soft Skills)"]
        },
        "coverLetter": { "draft_text": "string" }
      }
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

        return JSON.parse(text);

    } catch (error) {
        console.error("[Gemini] Error processing resume:", error);
        throw error;
    }
}

/**
 * Parses a resume to extract full text and structured data.
 * Optimized for complete content extraction rather than matching.
 * @param {string} inputData - Base64 encoded PDF data OR plain text resume.
 * @param {boolean} isPdf - True if inputData is base64 PDF, false if text.
 * @returns {Promise<object>} - Structured JSON with full text.
 */
export async function parseResumeOnly(inputData, isPdf = true) {
    try {
        console.log(`[Gemini] Parsing resume with ${MODEL_NAME}. Input type: ${isPdf ? "PDF" : "Text"}`);

        const systemInstruction = "You are a highly accurate OCR and resume parser. Your goal is to extract the FULL text verbatim and structure the data.";

        const prompt = `
      Please extract the following information from the resume.
      IMPORTANT: "plainText" must contain the COMPLETE text of the resume, preserving line breaks and structure as much as possible. Do not summarize the text; extract it fully.

      Return the response in the following JSON format:
      {
        "plainText": "string (The FULL verbatim text of the resume)",
        "candidateProfile": { 
            "name": "string", 
            "email": "string", 
            "phone": "string",
            "location": "string",
            "links": ["string"]
        },
        "summary": "string (Professional summary if present)",
        "skills": ["string"],
        "experience": [
            { 
                "title": "string", 
                "company": "string", 
                "dates": "string", 
                "description": "string" 
            }
        ],
        "education": [
            { 
                "degree": "string", 
                "school": "string", 
                "dates": "string" 
            }
        ],
        "certifications": ["string"],
        "languages": ["string"]
      }
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

        return JSON.parse(text);

    } catch (error) {
        console.error("[Gemini] Error parsing resume:", error);
        throw error;
    }
}
