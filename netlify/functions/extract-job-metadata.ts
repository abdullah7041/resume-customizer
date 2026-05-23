import { Handler } from '@netlify/functions';
import { withRateLimit } from '../lib/rate-limiter.js';
import { getSupabaseClient } from '../lib/supabase-client.js';
import { callOpenRouter } from '../lib/openrouter-client.js';
import { resolveFeatureConfig } from '../lib/model-router.js';
import { initSentry, captureError, summarizeErrorForLog } from '../lib/sentry.js';
import { z } from 'zod';

initSentry();

const RequestSchema = z.object({
  jobText: z.string().min(10).max(30000),
  language: z.enum(['en', 'ar']).default('en'),
});

const ResponseSchema = z.object({
  companyName: z.string().nullable(),
  jobTitle: z.string().nullable(),
  location: z.string().nullable(),
  employmentType: z.string().nullable(),
  seniority: z.string().nullable(),
  sector: z.string().nullable(),
  confidence: z.object({
    companyName: z.number().min(0).max(1),
    jobTitle: z.number().min(0).max(1),
    location: z.number().min(0).max(1),
  }),
  needsUserConfirmation: z.boolean(),
});

const baseHandler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Authentication required. Please sign in.' }),
      };
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const client = getSupabaseClient();
    if (!client) {
      return {
        statusCode: 503,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Service temporarily unavailable' }),
      };
    }

    const { data: { user }, error: authError } = await client.auth.getUser(token);
    if (authError || !user) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid or expired authentication token' }),
      };
    }

    const rawBody = JSON.parse(event.body || '{}');
    const parseResult = RequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid request: jobText is required (10-30000 chars)' }),
      };
    }

    const { jobText, language } = parseResult.data;

    const systemPrompt = language === 'ar'
      ? 'انت مساعد لاستخراج بيانات الوظائف من نصوص اعلانات التوظيف. استخرج فقط ما هو واضح ومؤكد. لا تخمن.'
      : 'You are a job metadata extraction assistant. Extract only what is clearly stated. Never hallucinate. If information is missing, return null.';

    const userPrompt = language === 'ar'
      ? 'استخرج البيانات التالية من اعلان الوظيفة هذا:\n\n' + jobText + '\n\nأعد النتيجة كـ JSON فقط بدون أي نص إضافي.'
      : 'Extract the following fields from this job posting:\n\n' + jobText + '\n\nReturn ONLY valid JSON, no extra text.';

    const jsonSchema = {
      type: 'object',
      properties: {
        companyName: { type: 'string', description: 'Company name if clearly stated, otherwise null' },
        jobTitle: { type: 'string', description: 'Exact job title if clearly stated, otherwise null' },
        location: { type: 'string', description: 'Job location if stated, otherwise null' },
        employmentType: { type: 'string', description: 'Full-time, part-time, contract, etc. if stated, otherwise null' },
        seniority: { type: 'string', description: 'Entry, mid, senior, lead, etc. if stated, otherwise null' },
        sector: { type: 'string', description: 'Industry/sector if stated, otherwise null' },
        confidence: {
          type: 'object',
          properties: {
            companyName: { type: 'number' },
            jobTitle: { type: 'number' },
            location: { type: 'number' },
          },
          required: ['companyName', 'jobTitle', 'location'],
        },
        needsUserConfirmation: { type: 'boolean' },
      },
      required: ['companyName', 'jobTitle', 'location', 'employmentType', 'seniority', 'sector', 'confidence', 'needsUserConfirmation'],
    };

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const config = resolveFeatureConfig('job_metadata_extraction');
    const aiResponse = await callOpenRouter(config.modelType, messages, jsonSchema, {
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      timeoutMs: config.timeoutMs,
      featureName: 'extract_job_metadata',
      modelId: config.modelId,
    });

    let parsed;
    try {
      parsed = JSON.parse(aiResponse);
    } catch {
      const jsonMatch = aiResponse.match(/`json\s*([\s\S]*?)\s*`/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Failed to parse AI response as JSON');
      }
    }

    const validated = ResponseSchema.parse(parsed);

    const conservativeResult = {
      companyName: validated.confidence.companyName >= 0.6 ? validated.companyName : null,
      jobTitle: validated.confidence.jobTitle >= 0.6 ? validated.jobTitle : null,
      location: validated.confidence.location >= 0.5 ? validated.location : null,
      employmentType: validated.employmentType,
      seniority: validated.seniority,
      sector: validated.sector,
      confidence: validated.confidence,
      needsUserConfirmation:
        validated.needsUserConfirmation ||
        validated.confidence.companyName < 0.8 ||
        validated.confidence.jobTitle < 0.8,
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conservativeResult),
    };
  } catch (error) {
    console.error('[extract-job-metadata] Error:', summarizeErrorForLog(error));
    captureError(error, { function: 'extract-job-metadata' });
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to extract job metadata. You can still save the job manually.',
        companyName: null,
        jobTitle: null,
        location: null,
        employmentType: null,
        seniority: null,
        sector: null,
        confidence: { companyName: 0, jobTitle: 0, location: 0 },
        needsUserConfirmation: true,
      }),
    };
  }
};

export const handler = withRateLimit('extract-job-metadata', baseHandler);
