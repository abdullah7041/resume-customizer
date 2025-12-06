import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    throw new Error("❌ GEMINI_API_KEY is missing from environment variables.");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const MODEL_NAME = "gemini-2.5-flash-lite";

const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
        responseMimeType: "application/json",
    },
});

/**
 * Analyzes a resume against a job description using Gemini.
 * @param {string} resumePath - Path to the PDF resume file.
 * @param {string} jobDescription - The job description text.
 * @returns {Promise<object>} - The structured JSON analysis.
 */
export async function analyzeResume(resumePath, jobDescription) {
    try {
        console.log(`🚀 Pipeline Active: Analyzing ${resumePath}`);

        // 1. Load PDF as base64
        const resumeBuffer = fs.readFileSync(resumePath);
        const resumeBase64 = resumeBuffer.toString("base64");

        // 2. System Instruction
        const systemInstruction = "You are an elite Technical Recruiter for the Saudi Market. Your goal is to rewrite resumes to pass strict ATS filters and impress human hiring managers.";

        // 3. The Prompt (optimized for "Lite" models)
        const prompt = `
      JOB DESCRIPTION:
      ${jobDescription}

      TASK:
      Analyze the attached resume PDF against the Job Description. 
      Identify gaps, rewrite weak sections, and prepare the candidate for the interview.

      OUTPUT JSON SCHEMA (Strictly follow this structure):
      {
        "candidateProfile": { 
            "name": "string", 
            "email": "string", 
            "current_role": "string" 
        },
        "matchAnalysis": { 
          "score_0_to_100": number, 
          "reasoning": "string",
          "vision2030_alignment": boolean
        }
      }
      `;

        // 4. Generate Content
        const result = await model.generateContent({
            contents: [{
                role: "user",
                parts: [
                    { text: systemInstruction },
                    { text: prompt },
                    { inlineData: { mimeType: "application/pdf", data: resumeBase64 } }
                ]
            }],
        });

        const text = result.response.text();
        const cleanJson = text.replace(/```json| ```/g, '').trim();

        return JSON.parse(cleanJson);

    } catch (error) {
        console.error("❌ Pipeline Error:", error);
        throw error;
    }
}