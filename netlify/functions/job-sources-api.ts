/**
 * The one user-facing function of the Job Feed: turn a company name or careers URL
 * into a board this app can actually read, and track or untrack it.
 *
 *   POST /.netlify/functions/job-sources-api
 *   body: { action: 'resolve', query }
 *       | { action: 'track', source, token, displayName, careersUrl? }
 *       | { action: 'untrack', companyId }
 *
 * Everything else the feed does — listing companies and postings, dismissing,
 * saving — is an RLS-protected browser query, the same way src/services/pipeline.ts
 * already works. Only outbound traffic to job boards needs a server.
 *
 * `resolve` is rate-limited harder than the rest for a reason: one call fans out
 * across every provider, which makes it both an amplifier and the fastest way to
 * get this app's IP blocked by the boards the feature depends on.
 */
import { Handler } from '@netlify/functions';
import { z } from 'zod';
import { withRateLimit } from '../lib/rate-limiter.js';
import { getSupabaseClient } from '../lib/supabase-client.js';
import { initSentry, captureError, summarizeErrorForLog } from '../lib/sentry.js';
import { resolveCompany } from '../lib/ats/probe.js';
import { getProvider } from '../lib/ats/index.js';
import type { AtsSource } from '../lib/ats/types.js';

initSentry();

/** The real cost control: crawl load scales with distinct companies, not users. */
export const MAX_TRACKED_COMPANIES = 25;

const SOURCES = [
  'greenhouse',
  'ashby',
  'workable',
  'lever',
  'pinpoint',
  'workday',
  'jsonld',
] as const;

const ResolveSchema = z.object({
  action: z.literal('resolve'),
  query: z.string().trim().min(2).max(300),
});

const TrackSchema = z.object({
  action: z.literal('track'),
  source: z.enum(SOURCES),
  token: z.string().trim().min(1).max(200),
  displayName: z.string().trim().min(1).max(120),
  careersUrl: z.string().trim().max(2048).optional(),
});

const UntrackSchema = z.object({
  action: z.literal('untrack'),
  companyId: z.string().uuid(),
});

const RequestSchema = z.discriminatedUnion('action', [ResolveSchema, TrackSchema, UntrackSchema]);

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

    const supabase = getSupabaseClient();
    if (!supabase) {
      return { statusCode: 503, headers: jsonHeaders, body: errorBody(503, 'server/misconfigured', 'Service temporarily unavailable') };
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return { statusCode: 401, headers: jsonHeaders, body: errorBody(401, 'auth/invalid', 'Invalid or expired authentication token') };
    }

    const parsed = RequestSchema.safeParse(JSON.parse(event.body || '{}'));
    if (!parsed.success) {
      return { statusCode: 400, headers: jsonHeaders, body: errorBody(400, 'request/invalid', 'Invalid request payload') };
    }

    switch (parsed.data.action) {
      case 'resolve':
        return await handleResolve(parsed.data.query);
      case 'track':
        return await handleTrack(supabase, user.id, parsed.data);
      case 'untrack':
        return await handleUntrack(supabase, user.id, parsed.data.companyId);
    }
  } catch (error) {
    captureError(error, { function: 'job-sources-api' });
    console.error('[JobSources] Unhandled error:', summarizeErrorForLog(error));
    return { statusCode: 500, headers: jsonHeaders, body: errorBody(500, 'server/error', 'Request failed') };
  }
};

async function handleResolve(query: string) {
  const report = await resolveCompany(query);

  // A total miss is a fact, not an error: the resolver must say so out loud and
  // point at the paste path, never return a silent empty list.
  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify({
      status: 'ok',
      candidates: report.candidates,
      unreliable: report.unreliable,
      exhausted: report.exhausted,
      fallback: report.exhausted ? 'paste_job_url' : null,
    }),
  };
}

type Supabase = NonNullable<ReturnType<typeof getSupabaseClient>>;

interface TrackInput {
  source: AtsSource;
  token: string;
  displayName: string;
  careersUrl?: string;
}

async function handleTrack(supabase: Supabase, userId: string, input: TrackInput) {
  const provider = getProvider(input.source);
  if (input.source !== 'jsonld' && (!provider || !provider.isValidToken(input.token))) {
    return { statusCode: 400, headers: jsonHeaders, body: errorBody(400, 'source/invalid-token', 'That token is not valid for this job board.') };
  }

  const { count, error: countError } = await supabase
    .from('user_tracked_companies')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) {
    console.error('[JobSources] Count failed:', summarizeErrorForLog(countError));
    return { statusCode: 500, headers: jsonHeaders, body: errorBody(500, 'server/error', 'Could not read your tracked companies') };
  }

  if ((count ?? 0) >= MAX_TRACKED_COMPANIES) {
    return {
      statusCode: 409,
      headers: jsonHeaders,
      body: errorBody(409, 'sources/limit-reached', `You can track up to ${MAX_TRACKED_COMPANIES} companies. Remove one to add another.`),
    };
  }

  // The registry is shared: a company another user already added is reused rather
  // than duplicated, which is what keeps crawl cost tied to distinct companies.
  const { data: company, error: upsertError } = await supabase
    .from('ats_companies')
    .upsert(
      {
        source: input.source,
        token: input.token,
        display_name: input.displayName,
        careers_url: input.careersUrl ?? null,
      },
      { onConflict: 'source,token', ignoreDuplicates: false },
    )
    .select('id, source, token, display_name, last_fetched_at')
    .single();

  if (upsertError || !company) {
    console.error('[JobSources] Company upsert failed:', summarizeErrorForLog(upsertError));
    return { statusCode: 500, headers: jsonHeaders, body: errorBody(500, 'server/error', 'Could not add that company') };
  }

  const { error: trackError } = await supabase
    .from('user_tracked_companies')
    .upsert({ user_id: userId, company_id: company.id }, { onConflict: 'user_id,company_id' });

  if (trackError) {
    console.error('[JobSources] Track failed:', summarizeErrorForLog(trackError));
    return { statusCode: 500, headers: jsonHeaders, body: errorBody(500, 'server/error', 'Could not track that company') };
  }

  // Cold start: without an immediate crawl the feed sits empty until the next cron
  // run and the feature reads as broken on first use.
  const crawlDispatched = await dispatchImmediateCrawl(company.id, Boolean(company.last_fetched_at));

  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify({ status: 'ok', company, crawlDispatched }),
  };
}

async function handleUntrack(supabase: Supabase, userId: string, companyId: string) {
  const { error } = await supabase
    .from('user_tracked_companies')
    .delete()
    .eq('user_id', userId)
    .eq('company_id', companyId);

  if (error) {
    console.error('[JobSources] Untrack failed:', summarizeErrorForLog(error));
    return { statusCode: 500, headers: jsonHeaders, body: errorBody(500, 'server/error', 'Could not remove that company') };
  }

  return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ status: 'ok' }) };
}

/** Fire-and-forget handoff. A failure here costs freshness, never the tracking itself. */
async function dispatchImmediateCrawl(companyId: string, alreadyCrawled: boolean): Promise<boolean> {
  if (alreadyCrawled) return false;

  const secret = process.env.JOB_CRAWL_SECRET;
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (!secret || !siteUrl) return false;

  try {
    const response = await fetch(`${siteUrl}/.netlify/functions/crawl-jobs-background`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-watheq-crawl-secret': secret },
      body: JSON.stringify({ companyIds: [companyId] }),
      signal: AbortSignal.timeout(8000),
    });
    return response.ok || response.status === 202;
  } catch (error) {
    console.warn('[JobSources] Immediate crawl handoff failed:', summarizeErrorForLog(error));
    return false;
  }
}

export const handler = withRateLimit('job-sources-api', baseHandler);
