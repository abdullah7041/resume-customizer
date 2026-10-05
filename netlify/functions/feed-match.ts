import type { Handler } from '@netlify/functions';
import { createHash } from 'crypto';
import { z } from 'zod';
import { processMatchOnly } from '../lib/gemini-client.js';
import { buildCacheKey, getCached, setCached } from '../lib/redis-cache.js';
import { checkCostBearingRateLimitForIdentifier } from '../lib/rate-limiter.js';
import { getSupabaseClient } from '../lib/supabase-client.js';
import { initSentry, captureError, summarizeErrorForLog } from '../lib/sentry.js';

initSentry();

const CONTRACT_VERSION = 'feed-match-v2';
const MAX_MATCH_RESUME_CHARS = 15_000;
const MAX_MATCH_JOB_CHARS = 5_000;
const jsonHeaders = { 'Content-Type': 'application/json' };
const failure = (statusCode: number, code: string, error: string) => ({
  statusCode, headers: jsonHeaders, body: JSON.stringify({ code, error }),
});
const ResumeSchema = z.object({
  id: z.string().trim().min(1).max(200),
  fingerprint: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(50_000),
});
const RequestSchema = z.object({
  postingId: z.string().uuid(),
  language: z.enum(['en', 'ar']).optional().default('en'),
  resumes: z.array(ResumeSchema).length(1),
});

type MatchResult = Awaited<ReturnType<typeof processMatchOnly>>;

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return failure(405, 'method_not_allowed', 'Method Not Allowed');
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) return failure(401, 'auth_required', 'Authentication required');

    const supabase = getSupabaseClient();
    if (!supabase) return failure(503, 'service_unavailable', 'Service unavailable');
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''));
    if (authError || !user) return failure(401, 'invalid_session', 'Invalid session');

    const parsed = RequestSchema.safeParse(JSON.parse(event.body || '{}'));
    if (!parsed.success) return failure(400, 'invalid_request', 'Invalid request payload');

    const { data: tracked, error: trackedError } = await supabase
      .from('user_tracked_companies')
      .select('company_id')
      .eq('user_id', user.id);
    if (trackedError) return failure(503, 'service_unavailable', 'Could not verify followed companies');
    const companyIds = (tracked ?? []).map((row: { company_id: string }) => row.company_id);
    if (!companyIds.length) return failure(404, 'posting_not_found', 'Posting not found');

    const { data: posting, error: postingError } = await supabase
      .from('job_postings')
      .select('id, description')
      .eq('id', parsed.data.postingId)
      .in('company_id', companyIds)
      .is('closed_at', null)
      .maybeSingle();
    if (postingError) return failure(503, 'service_unavailable', 'Could not load posting');
    const jobText = typeof posting?.description === 'string' ? posting.description.trim() : '';
    if (!jobText) return failure(422, 'missing_description', 'This posting has no complete job description to verify.');
    const matchedJobText = jobText.slice(0, MAX_MATCH_JOB_CHARS);
    const jobFingerprint = createHash('sha256').update(matchedJobText).digest('hex');
    const outcomes = await Promise.all(parsed.data.resumes.map(async (resume) => {
      const matchedResumeText = resume.text.slice(0, MAX_MATCH_RESUME_CHARS);
      const resumeFingerprint = createHash('sha256').update(matchedResumeText).digest('hex');
      const cacheKey = buildCacheKey(CONTRACT_VERSION, {
        userId: user.id,
        resumeFingerprint,
        jobFingerprint,
        language: parsed.data.language,
      });
      const cached = await getCached<MatchResult>(cacheKey);
      if (cached) return { ok: true as const, resumeId: resume.id, resumeFingerprint, cached: true, match: cached };

      const rate = await checkCostBearingRateLimitForIdentifier('feed-match', user.id);
      if (!rate.allowed) {
        const quotaUnavailable = rate.response?.statusCode === 503;
        return {
          ok: false as const,
          resumeId: resume.id,
          code: quotaUnavailable ? 'quota_unavailable' : 'limit_reached',
          error: quotaUnavailable ? 'Verification quota is temporarily unavailable' : 'Daily verification limit reached',
        };
      }
      try {
        const match = await processMatchOnly(matchedResumeText, matchedJobText, parsed.data.language, {
          featureName: 'feed_match',
          disableFallback: true,
          timeoutMs: 30_000,
        });
        await setCached(cacheKey, match, 86_400);
        return { ok: true as const, resumeId: resume.id, resumeFingerprint, cached: false, match };
      } catch (error) {
        return { ok: false as const, resumeId: resume.id, code: 'match_failed', error: summarizeErrorForLog(error) };
      }
    }));

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        postingId: parsed.data.postingId,
        jobFingerprint,
        results: outcomes.filter(outcome => outcome.ok),
        failures: outcomes.filter(outcome => !outcome.ok),
      }),
    };
  } catch (error) {
    captureError(error, { function: 'feed-match' });
    console.error('[feed-match] failed:', summarizeErrorForLog(error));
    return failure(500, 'verification_unavailable', 'Match verification failed');
  }
};
