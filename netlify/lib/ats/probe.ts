// Company discovery, with the guard that makes it trustworthy.
//
// A probe is only worth believing if the same probe MISSES a known-bad token.
// Some job APIs answer 200 for any string they are handed — SmartRecruiters
// returns `200 {"totalFound":0}` for literal nonsense, re-verified 2026-08-29 —
// so an unguarded prober invents companies with total confidence. Any provider
// whose control probe "succeeds" is reported unreliable and its results are
// suppressed rather than shown.

import { NAME_PROBEABLE, URL_ONLY } from './index.js';
import { parseWorkdayUrl, formatWorkdayToken, workday } from './workday.js';
import { jsonld } from './jsonld.js';
import type { AtsSource } from './types.js';
import { assertPublicHttpUrl } from '../safe-fetch.js';
import { SAUDI_STARTER_COMPANIES } from '../../../src/lib/jobs/saudiStarterCompanies.js';
import { normalizeText, looseArabicKey } from '../../../src/lib/jobs/normalize.js';

/**
 * Control tokens, deliberately of different shapes.
 *
 * A single long hyphenated token was not a guard: Workable 404s on the long form
 * but answers 200 with a zero count for a short plausible handle, so the probe
 * passed its own control and still credited a company that does not exist there. A
 * provider must miss on EVERY shape, so the list keeps one long hyphenated handle,
 * one short word, and one short alphanumeric.
 *
 * These are deliberately-unregisterable company handles, not credentials. They are
 * spelled as plain words rather than random characters so that neither a secret
 * scanner nor a reader mistakes them for one.
 */
export const CONTROL_TOKENS = [
  'watheq-control-does-not-exist',
  'nosuchcompany',
  'notarealaccount42',
] as const;

/** Kept for callers that just want one; the guard itself uses every shape. */
export const CONTROL_TOKEN = CONTROL_TOKENS[0];

export interface ResolutionCandidate {
  source: AtsSource;
  token: string;
  jobCount: number;
}

export interface ResolutionReport {
  coverageUrl?: string;
  candidates: ResolutionCandidate[];
  /** Providers whose control probe answered, and whose results were therefore dropped. */
  unreliable: AtsSource[];
  /** True when every provider was probed and none matched — not an error, a fact. */
  exhausted: boolean;
}

async function reliableProviders(): Promise<{ usable: typeof NAME_PROBEABLE; unreliable: AtsSource[] }> {
  const usable: typeof NAME_PROBEABLE = [];
  const unreliable: AtsSource[] = [];

  await Promise.all(
    NAME_PROBEABLE.map(async (provider) => {
      let answered = false;
      try {
        const results = await Promise.all(CONTROL_TOKENS.map((token) => provider.probe(token)));
        answered = results.some((result) => result.found);
      } catch {
        answered = false;
      }
      if (answered) unreliable.push(provider.source);
      else usable.push(provider);
    }),
  );

  return { usable, unreliable };
}

/**
 * Resolve one company handle or careers URL to the board(s) that actually serve it.
 * A URL is tried against the URL-only providers first, because a Workday careers
 * link carries everything needed and no name probe could find it.
 */
export async function resolveCompany(input: string): Promise<ResolutionReport> {
  const trimmed = input.trim();
  const candidates: ResolutionCandidate[] = [];

  let urlSource: AtsSource | undefined;
  if (/^https?:\/\//i.test(trimmed)) {
    const page = canonicalCareersUrl(trimmed);
    if (!page) return { candidates: [], unreliable: [], exhausted: true };
    const coords = parseWorkdayUrl(trimmed);
    if (coords) {
      const token = formatWorkdayToken(coords);
      const result = await workday.probe(token);
      if (result.found) {
        return { candidates: [{ source: 'workday', token, jobCount: result.count }], unreliable: [], exhausted: false };
      }
    }
    const host = new URL(page).hostname;
    if (/^(?:boards|job-boards)\.(?:eu\.)?greenhouse\.io$/.test(host)) urlSource = 'greenhouse';
    else if (host === 'jobs.ashbyhq.com') urlSource = 'ashby';
    else if (host === 'apply.workable.com') urlSource = 'workable';
    else if (/^jobs\.(?:eu\.)?lever\.co$/.test(host)) urlSource = 'lever';
    else if (/^[a-z0-9-]+\.pinpointhq\.com$/.test(host)) urlSource = 'pinpoint';
    // An employer URL proves no relationship to a similarly named ATS tenant.
    if (!urlSource) return tierTwo(page, []);
  }

  const arabicKey = looseArabicKey(trimmed);
  const normalized = normalizeText(trimmed);
  const known = SAUDI_STARTER_COMPANIES.find(company =>
    normalizeText(company.displayName) === normalized ||
    normalizeText(company.displayNameAr) === normalized ||
    (arabicKey.length > 1 && looseArabicKey(company.displayNameAr) === arabicKey));
  const handle = known?.token ?? toHandle(trimmed);
  if (!handle) return await tierTwo(trimmed, []);

  const { usable, unreliable } = await reliableProviders();

  await Promise.all(
    usable.filter(provider => !(known || urlSource) || provider.source === (known?.source ?? urlSource)).map(async (provider) => {
      try {
        const result = await provider.probe(handle);
        if (result.found) {
          candidates.push({ source: provider.source, token: handle, jobCount: result.count });
        }
      } catch {
        // A probe never raises; a miss is a miss.
      }
    }),
  );

  if (candidates.length === 0) return await tierTwo(trimmed, unreliable);

  candidates.sort((a, b) => b.jobCount - a.jobCount);
  return { candidates, unreliable, exhausted: false };
}

/**
 * Last resort before giving up: read the company's own careers page for the
 * JobPosting data it publishes for search engines. Only attempted for a URL — there
 * is no way to guess an employer's careers page from its name, and guessing would
 * mean fetching arbitrary hosts on a user's say-so.
 */
async function tierTwo(input: string, unreliable: AtsSource[]): Promise<ResolutionReport> {
  if (!/^https?:\/\//i.test(input) || !jsonld.isValidToken(input)) {
    return { candidates: [], unreliable, exhausted: true };
  }

  const result = await jsonld.fetchPostings({source: 'jsonld', token: input});
  if (!result.ok) return { candidates: [], unreliable, exhausted: true, coverageUrl: canonicalCareersUrl(input) };

  return {
    candidates: [{ source: 'jsonld', token: input, jobCount: result.postings.length }],
    unreliable,
    exhausted: false,
  };
}

export function canonicalCareersUrl(input: string): string | undefined {
  try {
    const url = assertPublicHttpUrl(input);
    if (url.protocol !== 'https:' || !url.hostname.includes('.')) return;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    // Keep existing origin-only request keys while preserving directory paths.
    const canonical = url.pathname === '/' ? url.origin + url.search : url.href;
    return canonical.length <= 2048 ? canonical : undefined;
  } catch { return; }
}

/**
 * A company name reduced to the handle an ATS would use. A miss is not proof of
 * absence — Lean's Ashby token is `LeanTech`, which no name-derived guess finds —
 * so the resolver must always offer manual token entry as well.
 */
export function toHandle(input: string): string {
  if (/^https?:\/\//i.test(input)) {
    try {
      const url = new URL(input);
      const known = /^(?:(?:boards|job-boards)\.(?:eu\.)?greenhouse\.io|jobs\.ashbyhq\.com|apply\.workable\.com|jobs\.(?:eu\.)?lever\.co)$/;
      if (known.test(url.hostname)) {
        return url.pathname.split('/').filter(Boolean)[0] ?? '';
      }
      const pinpointMatch = /^([A-Za-z0-9-]+)\.pinpointhq\.com$/.exec(url.hostname);
      if (pinpointMatch) return pinpointMatch[1];
      return url.hostname.replace(/^www\./, '').split('.')[0] ?? '';
    } catch {
      return '';
    }
  }

  return input.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
}

export { URL_ONLY };
