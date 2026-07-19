import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { executeAiContract } from '../lib/ai-contracts/executor.js';
import { withRateLimit } from '../lib/rate-limiter.js';
import { Vision2030RequestSchema, formatZodError } from '../lib/resume-schemas.js';
import { initSentry, captureError, summarizeErrorForLog } from '../lib/sentry.js';
import { addCredits, checkCredits, consumeCredits, isEmailVerified } from '../lib/credit-manager.js';
import { getClientIP } from '../lib/ip-utils.js';
import type { Vision2030AnalysisResponse } from '../lib/vision2030-types.js';

initSentry();

const baseHandler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Extract auth token from header
  const authHeader = event.headers.authorization || event.headers.Authorization;

  if (!authHeader) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Authentication required. Please sign in.' })
    };
  }

  // Verify token and get authenticated user
  const token = authHeader.replace(/^Bearer\s+/i, '');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Supabase configuration is missing' })
    };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid or expired authentication token' })
    };
  }

  const userEmail = user.email;

  // Extract IP and email verification for anti-abuse checks
  const ipAddress = getClientIP(event);
  const emailVerified = isEmailVerified(user);

  // Check credits BEFORE processing (2 credits for vision2030)
  const creditCheck = await checkCredits(userEmail, 'vision2030', { ipAddress, emailVerified });

  if (!creditCheck.hasCredits) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Insufficient credits',
        creditsRequired: creditCheck.required,
        creditsAvailable: creditCheck.available,
        creditsNeeded: creditCheck.required - creditCheck.available
      })
    };
  }

  let rawBody: unknown;

  try {
    rawBody = JSON.parse(event.body || '{}');

    // Validate request using Zod schema
    const parseResult = Vision2030RequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: formatZodError(parseResult.error) })
      };
    }

    const { resumeText, language = 'en', jobDescription } = parseResult.data;

    const startTime = Date.now();

    const analysis = await executeAiContract('vision2030_alignment', {
      resumeText,
      language,
      jobDescription,
    }) as Vision2030AnalysisResponse;

    const duration = Date.now() - startTime;
    console.log(`[vision2030-alignment] OpenRouter call took ${duration}ms`);

    // Consume credits AFTER successful analysis. The contract transform throws
    // on empty/unusable output, so garbage results never reach this point.
    const creditResult = await consumeCredits(userEmail, 'vision2030');

    // Fail-safe: once charged, any failure to deliver the result must refund.
    let responseBody: string;
    try {
      responseBody = JSON.stringify({
        ...analysis,
        creditsRemaining: creditResult.creditsRemaining,
      });
    } catch (deliveryError) {
      try {
        await addCredits(userEmail, creditCheck.required, 'refund', {
          feature: 'vision2030',
          reason: 'result_delivery_failed',
        });
        console.warn('[vision2030-alignment] refunded credits after delivery failure');
      } catch (refundError) {
        captureError(refundError, { function: 'vision2030-alignment', stage: 'refund' });
      }
      throw deliveryError;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: responseBody
    };

  } catch (error) {
    console.error('[vision2030-alignment] Error:', summarizeErrorForLog(error));

    // Don't send timeout errors to Sentry (expected behavior under load)
    if (error.name !== 'TimeoutError') {
      captureError(error, {
        function: 'vision2030-alignment',
        payload: {
          resumeTextLength: typeof (rawBody as { resumeText?: unknown })?.resumeText === 'string'
            ? ((rawBody as { resumeText: string }).resumeText.length)
            : 0,
          jobDescriptionLength: typeof (rawBody as { jobDescription?: unknown })?.jobDescription === 'string'
            ? ((rawBody as { jobDescription: string }).jobDescription.length)
            : 0,
          hasResumeText: Boolean((rawBody as { resumeText?: unknown })?.resumeText),
          hasJobDescription: Boolean((rawBody as { jobDescription?: unknown })?.jobDescription),
          language: (rawBody as { language?: unknown })?.language || null,
        }
      });
    }

    // Return 504 for timeout errors, 500 for other errors
    const isTimeout = error.name === 'TimeoutError' || error.status === 504;

    return {
      statusCode: isTimeout ? 504 : 500,
      headers: {
        'Content-Type': 'application/json',
        ...(isTimeout && {
          'Retry-After': '30',
          'X-Timeout-Location': 'openrouter-api'
        })
      },
      body: JSON.stringify({
        error: isTimeout
          ? 'Analysis timed out. Retrying automatically...'
          : 'Failed to analyze Vision 2030 alignment',
        retryable: isTimeout
      })
    };
  }
};

// Export handler with rate limiting applied
export const handler = withRateLimit('vision2030-alignment', baseHandler);
