import { Handler } from '@netlify/functions';
import { withRateLimit } from '../lib/rate-limiter.js';
import { getSupabaseClient } from '../lib/supabase-client.js';
import { executeAiContract } from '../lib/ai-contracts/executor.js';
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

    const parsed = await executeAiContract('job_metadata_extraction', {
      jobText,
      language,
    });

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
