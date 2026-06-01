import { Handler } from '@netlify/functions';
import { executeAiContract } from '../lib/ai-contracts/index.js';
import { withRateLimit } from '../lib/rate-limiter.js';
import { getSupabaseClient } from '../lib/supabase-client.js';
import { initSentry, captureError, summarizeErrorForLog } from '../lib/sentry.js';

initSentry();

const MAX_RESUME_TEXT_CHARS = 50_000;

// Type definition for parsed resume structure
interface ParsedResume {
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
  };
  objective: string;
  experience: Array<{
    title: string;
    titleEn: string;
    company: string;
    location: string;
    startDate: string;
    endDate: string;
    current: boolean;
    description: string[];
  }>;
  education: Array<{
    degree: string;
    institution: string;
    graduationDate: string;
    gpa: string;
  }>;
  skills: string[];
  certifications: string[];
  languages: Array<{
    name: string;
    level: string;
  }>;
}

const baseHandler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Authentication required. Please sign in.' }),
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Server configuration error. Please contact support.' }),
    };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid or expired authentication token' }),
    };
  }

  // Validate environment configuration
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('[parse-arabic-resume] OPENROUTER_API_KEY is not set');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Server configuration error: AI service not configured' }),
    };
  }

  try {
    const { resumeText, targetLanguage = 'ar' } = JSON.parse(event.body || '{}');

    if (typeof resumeText !== 'string' || !resumeText.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Resume text required' }) };
    }

    if (resumeText.length > MAX_RESUME_TEXT_CHARS) {
      return {
        statusCode: 413,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Resume text is too large. Please shorten it and try again.' }),
      };
    }

    const parsed = await executeAiContract('parse_arabic_resume', {
      resumeText,
      targetLanguage,
    }) as ParsedResume;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    };
  } catch (error) {
    console.error('Parse error:', summarizeErrorForLog(error));
    captureError(error, {
      function: 'parse-arabic-resume',
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to parse resume' }),
    };
  }
};

export const handler = withRateLimit('parse-arabic-resume', baseHandler);
