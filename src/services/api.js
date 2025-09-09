// src/services/api.js

// This file centralizes all communication with your backend Cloudflare Worker.
// It reads the base URL from the environment variables, which is a security best practice.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
import { supabase } from './supabase.js';

/**
 * A reusable function for making authenticated API calls to the backend.
 * @param {string} endpoint - The specific API endpoint to call (e.g., 'parse', 'analyze').
 * @param {object} data - The JSON payload to send with the request.
 * @param {string|null} sessionToken - The user's authentication token, if available.
 * @returns {Promise<any>} - The JSON response from the backend.
 */
export const callApi = async (endpoint, data, sessionToken = null) => {
  if (!API_BASE_URL) {
    console.error("VITE_API_BASE_URL is not defined in your .env file.");
    throw new Error("API URL is not configured.");
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  // If a session token is provided (i.e., the user is logged in), add it to the Authorization header.
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      // If the server returns an error, try to parse it and throw a detailed error.
      const errorText = await response.text();
      throw new Error(`API Error (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API call failed for endpoint '${endpoint}':`, error);
    throw error; // Re-throw the error so the UI component can catch it and show a notification.
  }
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
      Authorization: `Bearer ${import.meta.env.VITE_OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
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
