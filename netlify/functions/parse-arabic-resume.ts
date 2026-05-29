import { Handler } from '@netlify/functions';
import { callOpenRouter } from '../lib/openrouter-client.js';
import { withRateLimit } from '../lib/rate-limiter.js';
import { getSupabaseClient } from '../lib/supabase-client.js';
import { initSentry, captureError, summarizeErrorForLog } from '../lib/sentry.js';

initSentry();

// Model tier constant for resume parsing
const MODEL_TIER = 'lite'; // Fast, cost-effective model for parsing tasks
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

    const systemPrompt = targetLanguage === 'ar'
      ? `أنت محلل سير ذاتية متخصص. قم بتحليل السيرة الذاتية واستخراج المعلومات بتنسيق JSON.
         يجب أن يكون الرد بالعربية للمحتوى العربي وبالإنجليزية للمحتوى الإنجليزي.
         حافظ على الدقة ولا تضف معلومات غير موجودة في النص الأصلي.`
      : `You are a professional resume analyst. Parse the resume and extract information in JSON format.
         Preserve the original language of the content. Do not add information not present in the original text.`;

    const prompt = `${systemPrompt}

Parse this resume into structured JSON:

${resumeText}

Return JSON with this structure:
{
  "personalInfo": {
    "name": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": ""
  },
  "objective": "",
  "experience": [
    {
      "title": "",
      "titleEn": "",
      "company": "",
      "location": "",
      "startDate": "",
      "endDate": "",
      "current": false,
      "description": []
    }
  ],
  "education": [
    {
      "degree": "",
      "institution": "",
      "graduationDate": "",
      "gpa": ""
    }
  ],
  "skills": [],
  "certifications": [],
  "languages": [
    { "name": "", "level": "" }
  ]
}`;

    // Use OpenRouter with lite model for parsing
    const messages = [{ role: 'user', content: prompt }];
    const text = await callOpenRouter(MODEL_TIER, messages, null, { temperature: 0, maxTokens: 4096, featureName: 'parse_arabic_resume' });

    // Parse JSON response (callOpenRouter returns raw text)
    let parsed: ParsedResume;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[1].trim());
        } catch (innerError) {
          const errorMsg = innerError instanceof Error ? innerError.message : 'Unknown error';
          throw new Error(`Failed to parse JSON from markdown block: ${errorMsg}. Response length: ${text.length}.`);
        }
      } else {
        const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown error';
        throw new Error(`Failed to parse AI response as JSON: ${errorMsg}. Response length: ${text.length}.`);
      }
    }

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
