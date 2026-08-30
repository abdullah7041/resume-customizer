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

  if (/^https?:\/\//i.test(trimmed)) {
    const coords = parseWorkdayUrl(trimmed);
    if (coords) {
      const token = formatWorkdayToken(coords);
      const result = await workday.probe(token);
      if (result.found) {
        return { candidates: [{ source: 'workday', token, jobCount: result.count }], unreliable: [], exhausted: false };
      }
    }
  }

  const handle = toHandle(trimmed);
  if (!handle) return await tierTwo(trimmed, []);

  const { usable, unreliable } = await reliableProviders();

  await Promise.all(
    usable.map(async (provider) => {
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

  const result = await jsonld.probe(input);
  if (!result.found) return { candidates: [], unreliable, exhausted: true };

  return {
    candidates: [{ source: 'jsonld', token: input, jobCount: result.count }],
    unreliable,
    exhausted: false,
  };
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
      const known = /(?:boards|job-boards)\.(?:eu\.)?greenhouse\.io|jobs\.ashbyhq\.com|apply\.workable\.com|jobs\.lever\.co/;
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
