/**
 * Daily dispatcher for the Job Feed crawl.
 *
 * Scheduled functions get 30 seconds and cannot stream or be invoked by URL, so
 * this one does no fetching at all: it picks the stalest tracked companies, takes
 * a short lease on them, and hands them to crawl-jobs-background (15 minutes).
 *
 * Schedule lives in netlify.toml. Scheduled functions run only on published
 * production deploys — never on deploy previews or locally.
 */
import { Handler } from '@netlify/functions';
import { getSupabaseClient } from '../lib/supabase-client.js';
import { initSentry, captureError, summarizeErrorForLog } from '../lib/sentry.js';

initSentry();

/** How long a company is considered claimed before another run may retry it. */
const LEASE_MINUTES = 20;

/** Do not re-crawl a company more often than this. */
const MIN_HOURS_BETWEEN_CRAWLS = 20;

const BATCH_SIZE = 60;

const jsonHeaders = { 'Content-Type': 'application/json' };

interface CompanyIdRow {
  id: string;
}

export const handler: Handler = async () => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('[JobCrawlCron] Supabase unavailable');
      return { statusCode: 503, headers: jsonHeaders, body: JSON.stringify({ error: 'Service unavailable' }) };
    }

    const secret = process.env.JOB_CRAWL_SECRET;
    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL;
    if (!secret || !siteUrl) {
      console.error('[JobCrawlCron] Missing JOB_CRAWL_SECRET or site URL', { hasSecret: !!secret, hasUrl: !!siteUrl });
      return { statusCode: 503, headers: jsonHeaders, body: JSON.stringify({ error: 'Not configured' }) };
    }

    const now = Date.now();
    const staleBefore = new Date(now - MIN_HOURS_BETWEEN_CRAWLS * 60 * 60 * 1000).toISOString();
    const leaseUntil = new Date(now + LEASE_MINUTES * 60 * 1000).toISOString();

    // Selecting candidates and then writing the lease was wrong twice over: two
    // overlapping runs could read the same rows before either wrote, and expressing
    // "stale AND lease-free" as two chained PostgREST .or() filters does not AND the
    // way it reads — a leased company could be dispatched again, defeating the lease
    // this was all built for. The RPC does it in one statement with
    // FOR UPDATE SKIP LOCKED, and only ever sets a lease, never a completion.
    const { data: claimed, error } = await supabase.rpc('claim_job_crawl_batch', {
      p_lease_until: leaseUntil,
      p_stale_before: staleBefore,
      p_limit: BATCH_SIZE,
    });

    if (error) {
      console.error('[JobCrawlCron] Claim failed:', summarizeErrorForLog(error));
      return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: 'Claim failed' }) };
    }

    const companyIds = [...new Set(((claimed ?? []) as CompanyIdRow[]).map((row) => row.id))];
    if (companyIds.length === 0) {
      console.log('[JobCrawlCron] Nothing due');
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ dispatched: 0 }) };
    }

    // Background functions answer 202 and keep running; this call is the handoff,
    // not the work, so it must not be awaited for a result beyond the ack.
    const response = await fetch(`${siteUrl}/.netlify/functions/crawl-jobs-background`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-watheq-crawl-secret': secret },
      body: JSON.stringify({ companyIds }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok && response.status !== 202) {
      console.error(`[JobCrawlCron] Handoff rejected: HTTP ${response.status}`);
      // Release the lease so the next run retries rather than waiting it out.
      await supabase.from('ats_companies').update({ crawl_lease_until: null }).in('id', companyIds);
      return { statusCode: 502, headers: jsonHeaders, body: JSON.stringify({ error: 'Handoff failed' }) };
    }

    console.log(`[JobCrawlCron] Dispatched ${companyIds.length} companies`);
    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ dispatched: companyIds.length }) };
  } catch (error) {
    captureError(error, { function: 'cron-job-crawl' });
    console.error('[JobCrawlCron] Unhandled error:', summarizeErrorForLog(error));
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: 'Dispatch failed' }) };
  }
};
