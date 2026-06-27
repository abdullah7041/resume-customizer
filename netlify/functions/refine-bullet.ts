import { Handler } from '@netlify/functions';
import { withRateLimit } from '../lib/rate-limiter.js';
import { getSupabaseClient } from '../lib/supabase-client.js';
import { executeAiContract } from '../lib/ai-contracts/index.js';
import { initSentry, captureError, summarizeErrorForLog } from '../lib/sentry.js';
import { z } from 'zod';

initSentry();

// Single-bullet correction loop: one bullet + a short user instruction in, one
// refined bullet out. Tiny payload, single AI call — deliberately NOT routed
// through optimize.ts / optimize-stream.ts so their token/timeout budgets are
// untouched. resumeText is the only grounding source (no source_span exists).
const RequestSchema = z.object({
  original: z.string().min(1).max(2000),
  currentImproved: z.string().min(1).max(2000),
  userInstruction: z.string().min(1).max(500),
  jobContext: z.string().max(20000).optional().default(''),
  resumeText: z.string().min(1).max(60000),
  language: z.enum(['en', 'ar']).default('en'),
});

const jsonHeaders = { 'Content-Type': 'application/json' };

const errorBody = (status: number, code: string, message: string) =>
  JSON.stringify({ status, code, message, error: message });

const baseHandler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: jsonHeaders, body: errorBody(405, 'method/not-allowed', 'Method Not Allowed') };
    }

    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) {
      return { statusCode: 401, headers: jsonHeaders, body: errorBody(401, 'auth/required', 'Authentication required. Please sign in.') };
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { statusCode: 503, headers: jsonHeaders, body: errorBody(503, 'server/misconfigured', 'Service temporarily unavailable') };
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return { statusCode: 401, headers: jsonHeaders, body: errorBody(401, 'auth/invalid', 'Invalid or expired authentication token') };
    }

    const rawBody = JSON.parse(event.body || '{}');
    const parseResult = RequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: errorBody(400, 'request/invalid', 'Invalid request: original, currentImproved, userInstruction, and resumeText are required.'),
      };
    }

    const { original, currentImproved, userInstruction, jobContext, resumeText, language } = parseResult.data;

    console.log('[RefineBullet] Refining bullet', {
      instructionLength: userInstruction.length,
      resumeTextLength: resumeText.length,
      language,
    });

    const result = await executeAiContract('refine_bullet', {
      original,
      currentImproved,
      userInstruction,
      jobContext,
      resumeText,
      language,
    });

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        improved: result.improved,
        issue: result.issue,
        rationale: result.rationale,
      }),
    };
  } catch (error) {
    console.error('[RefineBullet] Error:', summarizeErrorForLog(error));
    captureError(error, { function: 'refine-bullet' });
    const status = (error as { status?: number })?.status ?? 500;
    return {
      statusCode: status === 504 ? 504 : 500,
      headers: jsonHeaders,
      body: errorBody(
        status === 504 ? 504 : 500,
        'refine/failed',
        'Failed to refine the bullet. Please try again.',
      ),
    };
  }
};

export const handler = withRateLimit('refine-bullet', baseHandler);
