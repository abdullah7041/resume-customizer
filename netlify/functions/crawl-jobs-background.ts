/**
 * Crawl the tracked company boards and refresh public.job_postings.
 *
 * The `-background` suffix is what buys the 15-minute budget: Netlify returns 202
 * immediately and lets this run on. Scheduled functions are capped at 30 seconds
 * and cannot do this work, which is why cron-job-crawl only leases and hands off.
 *
 * Background functions ARE invocable by URL (unlike scheduled ones), so this
 * endpoint is gated on a shared secret. Without it, it is a free outbound-fetch
 * amplifier pointed at the very boards this feature depends on.
 *
 *   POST /.netlify/functions/crawl-jobs-background
 *   header: x-watheq-crawl-secret
 *   body:   { companyIds: string[] }
 */
import { Handler } from '@netlify/functions';
import crypto from 'node:crypto';
import { getSupabaseClient } from '../lib/supabase-client.js';
import { batchWithConcurrency } from '../lib/rate-limiter.js';
import { initSentry, captureError, summarizeErrorForLog } from '../lib/sentry.js';
import { fetchCompany, getProvider } from '../lib/ats/index.js';
import type { AtsProvider, AtsSource, CompanyRef, RawPosting } from '../lib/ats/types.js';

initSentry();

const CONCURRENCY = 4;
const MAX_EAGER_DESCRIPTIONS_PER_COMPANY = 20;
const CLOSED_RETENTION_DAYS = 30;
const MAX_COMPANIES_PER_RUN = 200;

interface CompanyRow {
  id: string;
  source: AtsSource;
  token: string;
  display_name: string;
}

type Supabase = NonNullable<ReturnType<typeof getSupabaseClient>>;

interface CrawlResult {
  company: string;
  ok: boolean;
  postings: number;
  closed: number;
  error?: string;
}

const jsonHeaders = { 'Content-Type': 'application/json' };

function sha256(value: string): string | null {
  if (!value) return null;
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Constant-time compare that tolerates a wrong-length header. */
function secretMatches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const secret = process.env.JOB_CRAWL_SECRET;
    if (!secret) {
      console.error('[JobCrawl] JOB_CRAWL_SECRET is not configured - refusing to run');
      return { statusCode: 503, headers: jsonHeaders, body: JSON.stringify({ error: 'Not configured' }) };
    }

    const presented = event.headers['x-watheq-crawl-secret'] || '';
    if (!secretMatches(presented, secret)) {
      return { statusCode: 401, headers: jsonHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return { statusCode: 503, headers: jsonHeaders, body: JSON.stringify({ error: 'Service unavailable' }) };
    }

    const body = JSON.parse(event.body || '{}') as { companyIds?: unknown };
    const companyIds = Array.isArray(body.companyIds)
      ? body.companyIds.filter((id): id is string => typeof id === 'string').slice(0, MAX_COMPANIES_PER_RUN)
      : [];

    if (companyIds.length === 0) {
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ crawled: 0 }) };
    }

    const { data: companies, error } = await supabase
      .from('ats_companies')
      .select('id, source, token, display_name')
      .in('id', companyIds);

    if (error || !companies) {
      console.error('[JobCrawl] Failed to load companies:', summarizeErrorForLog(error));
      return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: 'Load failed' }) };
    }

    const settled = await batchWithConcurrency(
      companies as CompanyRow[],
      (company) => crawlCompany(supabase, company),
      { concurrency: CONCURRENCY },
    );

    const results = settled.map((entry) =>
      entry.status === 'fulfilled'
        ? entry.value
        : { company: 'unknown', ok: false, postings: 0, closed: 0, error: 'crawl threw' },
    );

    await pruneClosedPostings(supabase);

    const succeeded = results.filter((result) => result.ok).length;
    console.log(`[JobCrawl] Crawled ${companies.length} companies, ${succeeded} succeeded`);

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ crawled: companies.length, succeeded, results }),
    };
  } catch (error) {
    captureError(error, { function: 'crawl-jobs-background' });
    console.error('[JobCrawl] Unhandled error:', summarizeErrorForLog(error));
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: 'Crawl failed' }) };
  }
};

async function crawlCompany(supabase: Supabase, company: CompanyRow): Promise<CrawlResult> {
  try {
    return await crawlCompanyAttempt(supabase, company);
  } catch (error) {
    console.error('[JobCrawl] Board attempt failed:', summarizeErrorForLog(error));
    await supabase.from('ats_companies').update({ last_fetched_at: new Date().toISOString(), last_status: 'failed', last_error: 'crawl failed', crawl_lease_until: null }).eq('id', company.id);
    return { company: company.display_name, ok: false, postings: 0, closed: 0, error: 'crawl failed' };
  }
}

async function crawlCompanyAttempt(supabase: Supabase, company: CompanyRow): Promise<CrawlResult> {
  const outcome = await fetchCompany({ source: company.source, token: company.token });

  // A failed fetch also returns zero postings. Stamping the attempt keeps a broken
  // token from being retried on every run, but NOTHING is closed here: an empty
  // list from a 502 is indistinguishable from an empty board, and treating absence
  // as closure would let one bad minute retire a company's entire feed.
  if (!outcome.ok) {
    await supabase
      .from('ats_companies')
      .update({
        last_fetched_at: new Date().toISOString(),
        last_status: 'failed',
        last_error: outcome.error ?? 'unknown error',
        crawl_lease_until: null,
      })
      .eq('id', company.id);

    console.warn(`[JobCrawl] ${company.display_name}: ${outcome.error ?? 'fetch failed'} (nothing closed)`);
    return { company: company.display_name, ok: false, postings: 0, closed: 0, error: outcome.error };
  }

  const provider = getProvider(company.source);
  const postings = await hydratePostingDescriptions(provider, company, outcome.postings);
  const now = new Date().toISOString();
  const rows = postings.map((posting: RawPosting) => ({
    company_id: company.id,
    external_id: posting.externalId,
    title: posting.title,
    location: posting.location,
    apply_url: posting.applyUrl,
    posted_at: posting.postedAt,
    description: posting.description,
    description_sha256: sha256(posting.description),
    last_seen_at: now,
    // A posting that comes back is open again. first_seen_at is deliberately absent
    // from this payload, so an existing row keeps the date it was discovered.
    closed_at: null,
  }));

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from('job_postings')
      .upsert(rows, { onConflict: 'company_id,external_id' });

    if (upsertError) {
      console.error(`[JobCrawl] ${company.display_name}: upsert failed`, summarizeErrorForLog(upsertError));
      await supabase
        .from('ats_companies')
        .update({ last_fetched_at: new Date().toISOString(), last_status: 'failed', last_error: 'upsert failed', crawl_lease_until: null })
        .eq('id', company.id);
      return { company: company.display_name, ok: false, postings: 0, closed: 0, error: 'upsert failed' };
    }
  }

  // Some sources cannot be believed about absence — a careers page with no
  // structured data means "unreadable today", not "every role is gone".
  const trusted = provider?.closureSignal !== 'untrusted';
  const closed = trusted
    ? await reconcileClosures(supabase, company, rows.map((row) => row.external_id), now)
    : 0;

  await supabase
    .from('ats_companies')
    .update({
      last_fetched_at: now,
      last_status: 'ok',
      last_error: null,
      last_job_count: rows.length,
      crawl_lease_until: null,
    })
    .eq('id', company.id);

  console.log(`[JobCrawl] ${company.display_name}: ${rows.length} postings, ${closed} closed`);
  return { company: company.display_name, ok: true, postings: rows.length, closed };
}

export async function hydratePostingDescriptions(
  provider: AtsProvider | undefined,
  company: CompanyRef,
  postings: RawPosting[],
): Promise<RawPosting[]> {
  if (!provider?.fetchDescription) return postings;
  const fetchDescription = provider.fetchDescription;
  // One Workday detail call can consume two 12-second attempts. Hydrate only
  // the newest list page during the crawl so this best-effort enrichment cannot
  // exhaust the background-function window; older rows remain available and
  // their description is fetched lazily when the user opens them.
  const eager = postings.slice(0, MAX_EAGER_DESCRIPTIONS_PER_COMPANY);
  const settled = await batchWithConcurrency(eager, async (posting) => ({
    ...posting,
    description: posting.description || await fetchDescription(company, posting),
  }), { concurrency: CONCURRENCY });
  return [
    ...settled.map((result, index) => result.status === 'fulfilled' ? result.value : eager[index]),
    ...postings.slice(MAX_EAGER_DESCRIPTIONS_PER_COMPANY),
  ];
}

/**
 * Close the postings this company no longer lists.
 *
 * Only ever called after an explicitly successful fetch. A successful fetch that
 * returns nothing is a valid close-all — the board really is empty.
 */
async function reconcileClosures(
  supabase: Supabase,
  company: CompanyRow,
  seenIds: string[],
  now: string,
): Promise<number> {
  let query = supabase
    .from('job_postings')
    .update({ closed_at: now })
    .eq('company_id', company.id)
    .is('closed_at', null);

  if (seenIds.length > 0) {
    const quoted = seenIds.map((id) => JSON.stringify(id)).join(',');
    query = query.not('external_id', 'in', `(${quoted})`);
  }

  const { data, error } = await query.select('id');
  if (error) {
    console.error(`[JobCrawl] ${company.display_name}: close pass failed`, summarizeErrorForLog(error));
    throw new Error('Postings reconciliation failed');
  }
  return data?.length ?? 0;
}

/** Postings stay readable for a while after they close, then go. */
async function pruneClosedPostings(supabase: Supabase): Promise<void> {
  const cutoff = new Date(Date.now() - CLOSED_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from('job_postings').delete().lt('closed_at', cutoff);
  if (error) {
    console.error('[JobCrawl] Prune failed:', summarizeErrorForLog(error));
  }
}
