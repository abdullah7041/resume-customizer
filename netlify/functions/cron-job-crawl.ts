/**
 * Hourly dispatcher for the Job Feed crawl.
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
const MIN_HOURS_BETWEEN_CRAWLS = 1;

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
    let dispatched = 0;
    const deadline = Date.now() + 18_000;
    do {
      const { data: claimed, error } = await supabase.rpc('claim_job_crawl_batch', {
        p_lease_until: leaseUntil, p_stale_before: staleBefore, p_limit: BATCH_SIZE,
      });
      if (error) throw error;
      const companyIds = [...new Set(((claimed ?? []) as CompanyIdRow[]).map(row => row.id))];
      if (!companyIds.length) break;
      const response = await fetch(`${siteUrl}/.netlify/functions/crawl-jobs-background`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-watheq-crawl-secret': secret },
        body: JSON.stringify({ companyIds }), signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error('Crawl handoff failed; lease expires for retry');
      dispatched += companyIds.length;
    } while (Date.now() < deadline);
    console.log('[JobCrawlCron] Dispatched', { dispatched });
    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ dispatched }) };
  } catch (error) {
    captureError(error, { function: 'cron-job-crawl' });
    console.error('[JobCrawlCron] Unhandled error:', summarizeErrorForLog(error));
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: 'Dispatch failed' }) };
  }
};
