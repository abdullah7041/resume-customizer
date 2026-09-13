// src/services/jobFeed.ts
// Service layer for the Job Feed (Supabase RLS), mirroring src/services/pipeline.ts.
//
// Reads run straight from the browser under RLS — no server endpoint is needed to
// list companies or postings. Only outbound traffic to job boards goes through a
// Netlify function (job-sources-api).

import { supabase } from '@/services/supabase';
import { importJobFromUrl } from '@/services/api';
import type { CandidateProfile, EvidenceSource, JobRequirements, FeedIntent, FeedPosting } from '@/lib/jobs/types';
import type { CrawlRequest } from '@/lib/jobs/boardFreshness';
import type { SearchIntent } from '@/types/onboarding';

const COMPANIES_TABLE = 'ats_companies';
const TRACKED_TABLE = 'user_tracked_companies';
const POSTINGS_TABLE = 'job_postings';
const FEED_STATE_TABLE = 'user_job_feed_state';

/**
 * The list query NEVER selects `description`.
 *
 * Scoring reads only the title and location, and a tracked set of 25 boards holds
 * thousands of postings with several KB of JD each — shipping that on every feed
 * open would be megabytes for nothing. The JD is loaded per posting, on demand.
 */
const POSTING_COLUMNS = 'id, company_id, external_id, title, location, apply_url, posted_at, first_seen_at';

export interface TrackedCompany {
  companyId: string;
  displayName: string;
  source: string;
  token: string;
  trackedSince: string;
  lastFetchedAt: string | null;
  lastStatus: 'pending' | 'ok' | 'failed';
  lastJobCount: number;
}

export interface ResolutionCandidate {
  source: string;
  token: string;
  jobCount: number;
}

export interface ResolutionReport {
  candidates: ResolutionCandidate[];
  unreliable: string[];
  exhausted: boolean;
  fallback: 'paste_job_url' | null;
}

export type FeedStateValue = 'dismissed' | 'saved';

function summarizeError(error: unknown) {
  const e = error as { message?: string; code?: string; status?: number };
  return { message: e.message || 'Unknown error', code: e.code || 'unknown', status: e.status || 500 };
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function callSourcesApi<T>(payload: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  const headers = await authHeaders();
  if (!headers) return { data: null, error: 'Not signed in' };

  try {
    const response = await fetch('/.netlify/functions/job-sources-api', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) {
      return { data: null, error: body?.message || 'Request failed' };
    }
    return { data: body as T, error: null };
  } catch (error) {
    console.error('[JobFeed] job-sources-api call failed:', summarizeError(error));
    return { data: null, error: 'Network error' };
  }
}

/** Probe a company name or careers URL against every readable job board. */
export function resolveCompany(query: string) {
  return callSourcesApi<ResolutionReport>({ action: 'resolve', query });
}

export function trackCompany(input: {
  source: string;
  token: string;
  displayName: string;
  careersUrl?: string;
}) {
  return callSourcesApi<{ company: { id: string }; crawlDispatched: boolean; request?: CrawlRequest }>({
    action: 'track',
    ...input,
  });
}

export function untrackCompany(companyId: string) {
  return callSourcesApi<{ status: string }>({ action: 'untrack', companyId });
}

/**
 * Ask the server to re-read the boards this user follows.
 *
 * Distinct from `load()` in the feed, which re-reads the DATABASE. Only the daily
 * cron ever went out to the employer boards, so a user watching for a new posting
 * had no way to ask for one. The server scopes this to the caller's own companies
 * and skips any board read within the last hour, so pressing it repeatedly costs
 * nothing. The crawl itself is a background function: a successful call means the
 * work was accepted, not that new postings have landed yet.
 */
export function recrawlTrackedCompanies() {
  return callSourcesApi<{ dispatched: number; skipped: number; crawlDispatched: boolean; request?: CrawlRequest }>({
    action: 'recrawl',
  });
}

export async function loadJobRequirements(postingIds: string[]) {
  const requirements: Record<string, JobRequirements> = {};
  for (let offset = 0; offset < postingIds.length; offset += 500) {
    const result = await callSourcesApi<{ requirements: Record<string, JobRequirements> }>({ action: 'requirements', postingIds: postingIds.slice(offset, offset + 500) });
    if (result.error) return result;
    Object.assign(requirements, result.data?.requirements);
  }
  return { data: { requirements }, error: null };
}

export async function loadCandidateProfile(sources: EvidenceSource[], claimedSkills: string[]): Promise<CandidateProfile | null> {
  const headers = await authHeaders();
  if (!headers) return null;
  try {
    const response = await fetch('/.netlify/functions/feed-profile', { method: 'POST', headers, body: JSON.stringify({ sources, claimedSkills }), signal: AbortSignal.timeout(25000) });
    if (!response.ok) return null;
    const body = await response.json() as { profile: CandidateProfile };
    return body.profile;
  } catch (error) {
    console.warn('[JobFeed] Candidate profile unavailable:', summarizeError(error));
    return null;
  }
}

export async function listTrackedCompanies(): Promise<{ companies: TrackedCompany[]; error: string | null }> {
  const { data, error } = await supabase
    .from(TRACKED_TABLE)
    .select(
      `company_id, created_at, ${COMPANIES_TABLE}!inner(id, display_name, source, token, last_fetched_at, last_status, last_job_count)`,
    )
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[JobFeed] Failed to list tracked companies:', summarizeError(error));
    return { companies: [], error: summarizeError(error).message };
  }

  interface TrackedRow {
    company_id: string;
    created_at: string;
    ats_companies: {
      display_name: string;
      source: string;
      token: string;
      last_fetched_at: string | null;
      last_status: 'pending' | 'ok' | 'failed';
      last_job_count: number;
    };
  }

  const companies = ((data ?? []) as unknown as TrackedRow[]).map((row) => ({
    companyId: row.company_id,
    displayName: row.ats_companies.display_name,
    source: row.ats_companies.source,
    token: row.ats_companies.token,
    trackedSince: row.created_at,
    lastFetchedAt: row.ats_companies.last_fetched_at,
    lastStatus: row.ats_companies.last_status,
    lastJobCount: row.ats_companies.last_job_count,
  }));

  return { companies, error: null };
}

export interface PostingsPage {
  postings: FeedPosting[];
  error: string | null;
}

/** Open postings for the given companies. Descriptions are deliberately excluded. */
export async function listOpenPostings(
  companies: TrackedCompany[],
  limit = 500,
): Promise<PostingsPage> {
  if (companies.length === 0) return { postings: [], error: null };

  const nameById = new Map(companies.map((company) => [company.companyId, company.displayName]));

  const { data, error } = await supabase
    .from(POSTINGS_TABLE)
    .select(POSTING_COLUMNS)
    .in('company_id', [...nameById.keys()])
    .is('closed_at', null)
    .order('first_seen_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[JobFeed] Failed to list postings:', summarizeError(error));
    return { postings: [], error: summarizeError(error).message };
  }

  interface PostingRow {
    id: string;
    company_id: string;
    title: string;
    location: string;
    apply_url: string;
    posted_at: string | null;
    first_seen_at: string;
  }

  const postings: FeedPosting[] = ((data ?? []) as PostingRow[]).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    companyName: nameById.get(row.company_id) ?? '',
    title: row.title,
    location: row.location,
    applyUrl: row.apply_url,
    postedAt: row.posted_at,
    firstSeenAt: row.first_seen_at,
  }));

  return { postings, error: null };
}

/**
 * The JD for one posting, fetched only when it is opened or matched against a CV.
 *
 * Returns `null` when the READ failed, and a string — possibly empty — when it
 * succeeded. The two are genuinely different: Workday publishes no body at all
 * (`ats/workday.ts` sets `description: ''` for every posting) and Workable falls
 * back to `''`, so an empty description is a normal, permanent property of some
 * boards rather than a transient error. Collapsing both into `''` is what let a
 * caller tell those users to "try again in a moment" forever.
 */
export async function getPostingDescription(postingId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from(POSTINGS_TABLE)
    .select('description, apply_url')
    .eq('id', postingId)
    .maybeSingle();

  if (error) {
    console.error('[JobFeed] Failed to load description:', summarizeError(error));
    return null;
  }
  const posting = data as { description?: string; apply_url?: string } | null;
  if (posting?.description?.trim()) return posting.description;
  if (!posting?.apply_url) return '';
  const imported = await importJobFromUrl(posting.apply_url);
  if (imported.status === 'ok') return imported.jobText;
  return ['jd_not_found', 'unsupported_url'].includes(imported.failureReason) ? '' : null;
}

export async function listFeedState(): Promise<Map<string, FeedStateValue>> {
  const { data, error } = await supabase.from(FEED_STATE_TABLE).select('posting_id, state');

  if (error) {
    console.error('[JobFeed] Failed to load feed state:', summarizeError(error));
    return new Map();
  }

  const rows = (data ?? []) as { posting_id: string; state: FeedStateValue }[];
  return new Map(rows.map((row) => [row.posting_id, row.state]));
}

/**
 * Mark a posting dismissed or saved.
 *
 * Dismiss hides, and nothing more — there is no behavioural down-ranking here on
 * purpose. Selection rules that drift on their own are the ones people stop
 * trusting, which is why the digest this feature grew out of keeps calibration
 * manual too.
 */
export async function setFeedState(postingId: string, state: FeedStateValue): Promise<{ error: string | null }> {
  const { data: session } = await supabase.auth.getUser();
  const userId = session.user?.id;
  if (!userId) return { error: 'Not signed in' };

  const { error } = await supabase
    .from(FEED_STATE_TABLE)
    .upsert(
      { user_id: userId, posting_id: postingId, state, acted_at: new Date().toISOString() },
      { onConflict: 'user_id,posting_id' },
    );

  if (error) {
    console.error('[JobFeed] Failed to set feed state:', summarizeError(error));
    return { error: summarizeError(error).message };
  }
  return { error: null };
}

/**
 * The intent stored on the profile, for when the local store has none.
 *
 * The feed reads intent from the Zustand store, which is per-browser. A signed-in
 * user who onboarded on another device — or cleared local storage — has an intent
 * on the server and none locally, and would otherwise be told to set a target role
 * they have already set. Moving intent server-side is what makes this fixable, and
 * the feed is its first consumer.
 */
export async function fetchServerSearchIntent(): Promise<FeedIntent | null> {
  const headers = await authHeaders();
  if (!headers) return null;

  try {
    const response = await fetch('/.netlify/functions/user-data-api', {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'get_search_intent' }),
    });
    if (!response.ok) return null;

    const body = (await response.json()) as { searchIntent?: FeedIntent | null };
    const intent = body?.searchIntent;
    return intent?.targetRoles?.length ? intent : null;
  } catch (error) {
    console.error('[JobFeed] Failed to read server search intent:', summarizeError(error));
    return null;
  }
}

/**
 * Store the intent on the profile, so a role picked here survives this browser.
 *
 * The local store is per-browser; `fetchServerSearchIntent` is what makes an intent
 * set on one device visible on the next. A role chosen from the CV has to go the
 * same way, or the feed asks for it again on every other device.
 */
export async function saveSearchIntent(searchIntent: SearchIntent): Promise<{ error: string | null }> {
  const headers = await authHeaders();
  if (!headers) return { error: 'Not signed in' };

  try {
    const response = await fetch('/.netlify/functions/user-data-api', {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'save_search_intent', searchIntent }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      const message = body.message ?? body.error ?? `Request failed (${response.status})`;
      console.error('[JobFeed] Failed to save search intent:', message);
      return { error: message };
    }
    return { error: null };
  } catch (error) {
    console.error('[JobFeed] Failed to save search intent:', summarizeError(error));
    return { error: summarizeError(error).message };
  }
}

/** Read and advance the "new since your last visit" marker. */
export async function readLastFeedSeenAt(): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('last_feed_seen_at')
    .maybeSingle();

  if (error) {
    console.error('[JobFeed] Failed to read last seen marker:', summarizeError(error));
    return null;
  }
  return (data as { last_feed_seen_at?: string | null } | null)?.last_feed_seen_at ?? null;
}

export async function touchLastFeedSeenAt(): Promise<void> {
  const { data: session } = await supabase.auth.getUser();
  const userId = session.user?.id;
  if (!userId) return;

  const { error } = await supabase
    .from('user_profiles')
    .update({ last_feed_seen_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    console.error('[JobFeed] Failed to advance last seen marker:', summarizeError(error));
  }
}
