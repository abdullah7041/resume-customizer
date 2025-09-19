// src/services/api.js

import { supabase } from './supabase.js';

/**
 * Parse resume text using OpenAI and return plain text.
 * @param {string} resumeText
 * @returns {Promise<string>}
 */
export const parseResume = async (resumeText) => {
  const prompt = `Extract the plain text from this resume and return JSON {"text": "..."}.\nResume:\n${resumeText}`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.VITE_OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      input: prompt,
      response_format: { type: 'json_object' },
    }),
  });

  const data = await response.json();
  const raw = data.output_text || data.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw);

  return parsed.text || resumeText;
};

/**
 * Analyze a resume against a job description using OpenAI.
 * Persists the result in Supabase.
 * @param {string} resumeText
 * @param {string} jobText
 * @returns {Promise<{score:number, missingKeywords:string[], suggestions:string[]}>}
 */
export const analyzeResume = async (resumeText, jobText) => {
  const prompt = `Compare the following resume with the job description and return JSON with score (0-100), missingKeywords[], suggestions[].\nResume:${resumeText}\nJob:${jobText}`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.VITE_OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      input: prompt,
      response_format: { type: 'json_object' },
    }),
  });

  const data = await response.json();
  const raw = data.output_text || data.choices?.[0]?.message?.content || '{}';
  const result = JSON.parse(raw);

  await supabase.from('job_matches').insert({
    resume_text: resumeText,
    job_text: jobText,
    score: result.score,
    missing_keywords: result.missingKeywords,
    suggestions: result.suggestions,
  });

  return result;
};
