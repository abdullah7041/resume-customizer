/**
 * generate-clarifications.ts — Pre-optimization Gap Interrogation Endpoint
 *
 * Analyzes a resume against a job description to surface 0–3 critical
 * data gaps (missing metrics, equivalency context, impact numbers).
 * Returns structured clarification questions the user can answer in the
 * ClarificationModal before the main optimize call runs.
 *
 * Design notes:
 * - FREE: no credits consumed (treated as part of the optimize UX flow)
 * - Cached: Redis 30-min TTL keyed on resume+JD+language hash
 * - Bilingual: Arabic language instruction injected when language === 'ar'
 * - Non-fatal on the client: any error returns { clarifications: [] }
 */

import { Handler } from '@netlify/functions';
import { executeAiContract } from '../lib/ai-contracts/executor.js';
import { withRateLimit } from '../lib/rate-limiter.js';
import { ClarificationRequestSchema, formatZodError } from '../lib/resume-schemas.js';
import { initSentry, captureError, redactForLog, summarizeErrorForLog } from '../lib/sentry.js';
import { buildCacheKey, getCached, setCached } from '../lib/redis-cache.js';
import { getSupabaseClient } from '../lib/supabase-client.js';
import { getClientIP } from '../lib/ip-utils.js';

initSentry();

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
const baseHandler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // --- Auth ---
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Authentication required. Please sign in.' }),
    };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Server configuration error.' }),
    };
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid or expired authentication token' }),
    };
  }

  // --- Parse & validate ---
  let rawBody: any;
  try {
    rawBody = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const parseResult = ClarificationRequestSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: formatZodError(parseResult.error) }),
    };
  }

  const { resumeText, jobText, language, regenerate } = parseResult.data;

  // --- Redis cache check (30-min TTL) ---
  const cacheKey = buildCacheKey('clarify', {
    resumeText: resumeText.trim().substring(0, 500), // Use first 500 chars as fingerprint (fast hash)
    jobText: jobText.trim().substring(0, 300),
    language: language || 'en',
  });

  if (regenerate) {
    console.log('[generate-clarifications] Cache BYPASS (regenerate)');
  } else {
    const cached = await getCached<{ clarifications: unknown[] }>(cacheKey);
    if (cached) {
      console.log('[generate-clarifications] Cache HIT');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
        body: JSON.stringify(cached),
      };
    }
  }

  // --- AI call ---
  try {
    console.log(`[generate-clarifications] Calling AI (user: ${redactForLog(user.email)}, ip: ${getClientIP(event)})`);

    const parsed = await executeAiContract('clarification_questions', {
      resumeText,
      jobText,
      language: language || 'en',
    });
    parsed.clarifications = parsed.clarifications.slice(0, 3);

    console.log(`[generate-clarifications] Returning ${parsed.clarifications.length} question(s)`);

    // Cache the result
    await setCached(cacheKey, parsed, 600); // Sensitive resume/JD-derived output; keep briefly.

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
      body: JSON.stringify(parsed),
    };
  } catch (error) {
    console.error('[generate-clarifications] AI call failed:', summarizeErrorForLog(error));
    captureError(error, {
      function: 'generate-clarifications',
      userId: user.id,
    });
    // Non-fatal: return empty so the optimize flow proceeds unblocked
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clarifications: [] }),
    };
  }
};

export const handler = withRateLimit('generate-clarifications', baseHandler);
