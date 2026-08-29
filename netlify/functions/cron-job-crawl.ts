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
    const leaseFreeBefore = new Date(now).toISOString();
    const leaseUntil = new Date(now + LEASE_MINUTES * 60 * 1000).toISOString();

    // Only companies somebody actually follows. The inner join is what keeps cost
    // proportional to distinct tracked companies rather than to the registry.
    const { data: candidates, error } = await supabase
      .from('ats_companies')
      .select('id, last_fetched_at, crawl_lease_until, user_tracked_companies!inner(user_id)')
      .or(`last_fetched_at.is.null,last_fetched_at.lt.${staleBefore}`)
      .or(`crawl_lease_until.is.null,crawl_lease_until.lt.${leaseFreeBefore}`)
      .order('last_fetched_at', { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE);

    if (error) {
      console.error('[JobCrawlCron] Candidate query failed:', summarizeErrorForLog(error));
      return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: 'Query failed' }) };
    }

    const companyIds = [...new Set((candidates ?? []).map((row) => (row as CompanyIdRow).id))];
    if (companyIds.length === 0) {
      console.log('[JobCrawlCron] Nothing due');
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ dispatched: 0 }) };
    }

    // The lease claims the work; it does NOT record it as done. last_fetched_at is
    // stamped by the crawler after its upsert lands, so a background run that dies
    // leaves these companies eligible again the moment the lease expires.
    const { error: leaseError } = await supabase
      .from('ats_companies')
      .update({ crawl_lease_until: leaseUntil })
      .in('id', companyIds);

    if (leaseError) {
      console.error('[JobCrawlCron] Lease failed:', summarizeErrorForLog(leaseError));
      return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: 'Lease failed' }) };
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
