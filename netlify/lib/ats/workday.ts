// Workday career-site API (verified live 2026-08-29).
//
//   POST https://{tenant}.{host}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs
//   body {"limit":20,"offset":0,"searchText":""}
//   -> { total, jobPostings: [{ title, externalPath, locationsText, postedOn, bulletFields }] }
//
// Workday is what most large enterprises run, so it is the widest single source
// here. Two things differ from every other provider:
//
//  - There is no company-name probe. A tenant alone is not enough: the site name
//    is part of the path and is not derivable, so Workday companies are resolved
//    from a pasted careers URL, never guessed. The token is `tenant:host:site`.
//  - `postedOn` is relative prose ("Posted Yesterday"), not a date. It is NOT
//    parsed — `postedAt` stays null and ordering falls back to first-seen.
//
// The JD needs one GET per job, the only Tier 1 source that scales per posting,
// so it is fetched lazily rather than during the crawl.

import { boundDescription, getJson, postJson, stripHtml } from './http.js';
import type { AtsProvider, CompanyRef, FetchOutcome, ProbeResult, RawPosting } from './types.js';

interface WorkdayPosting {
  title?: string;
  externalPath?: string;
  locationsText?: string;
  bulletFields?: string[];
}

interface WorkdayPage {
  total?: number;
  jobPostings?: WorkdayPosting[];
}

export interface WorkdayCoordinates {
  tenant: string;
  host: string;
  site: string;
}

const PAGE_SIZE = 20;
const MAX_PAGES = 25;

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const HOST_SHARD = /^wd\d{1,3}$/;

export function parseWorkdayToken(token: string): WorkdayCoordinates | null {
  const [tenant, host, site] = token.split(':');
  if (!tenant || !host || !site) return null;
  if (!SEGMENT.test(tenant) || !HOST_SHARD.test(host) || !SEGMENT.test(site)) return null;
  return { tenant, host, site };
}

export function formatWorkdayToken(coords: WorkdayCoordinates): string {
  return `${coords.tenant}:${coords.host}:${coords.site}`;
}

/** Read `https://acme.wd5.myworkdayjobs.com/en-US/AcmeCareers` into coordinates. */
export function parseWorkdayUrl(rawUrl: string): WorkdayCoordinates | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const hostMatch = /^([A-Za-z0-9-]+)\.(wd\d{1,3})\.myworkdayjobs\.com$/.exec(url.hostname);
  if (!hostMatch) return null;

  const segments = url.pathname.split('/').filter(Boolean);
  // The path is either /{site} or /{locale}/{site}; a locale looks like en-US.
  const site = segments.find((segment) => !/^[a-z]{2}-[A-Z]{2}$/.test(segment) && segment !== 'wday');
  if (!site || !SEGMENT.test(site)) return null;

  return { tenant: hostMatch[1], host: hostMatch[2], site };
}

const apiUrl = (c: WorkdayCoordinates) =>
  `https://${c.tenant}.${c.host}.myworkdayjobs.com/wday/cxs/${c.tenant}/${c.site}/jobs`;

const siteUrl = (c: WorkdayCoordinates, path: string) =>
  `https://${c.tenant}.${c.host}.myworkdayjobs.com/${c.site}${path}`;

export const workday: AtsProvider = {
  source: 'workday',

  isValidToken: (token) => parseWorkdayToken(token) !== null,

  async fetchPostings(ref: CompanyRef): Promise<FetchOutcome> {
    const coords = parseWorkdayToken(ref.token);
    if (!coords) return { ok: false, status: null, postings: [], error: 'invalid workday token' };

    const collected: WorkdayPosting[] = [];
    let offset = 0;
    // Only the first page reports `total`; later pages omit it. Recomputing it per
    // page set total to what had been collected so far and ended the crawl after
    // two pages (40 of 2000 postings on the live NVIDIA board).
    let total: number | null = null;
    let pages = 0;

    do {
      const response = await postJson(apiUrl(coords), {
        limit: PAGE_SIZE,
        offset,
        searchText: '',
        appliedFacets: {},
      });
      if (!response.ok) {
        return { ok: false, status: response.status, postings: [], error: response.error };
      }

      const page = response.body as WorkdayPage;
      if (!Array.isArray(page?.jobPostings)) {
        return { ok: false, status: 200, postings: [], error: 'unexpected workday payload' };
      }

      collected.push(...page.jobPostings);
      if (total === null) total = typeof page.total === 'number' ? page.total : collected.length;
      if (page.jobPostings.length === 0) break;
      offset += PAGE_SIZE;
      pages += 1;
    } while (collected.length < total && pages < MAX_PAGES);

    const postings: RawPosting[] = collected.map((job) => ({
      externalId: job.bulletFields?.[0] ?? job.externalPath ?? '',
      title: (job.title ?? '').trim(),
      location: (job.locationsText ?? '').trim(),
      applyUrl: job.externalPath ? siteUrl(coords, job.externalPath) : '',
      postedAt: null,
      description: '',
    }));

    return { ok: true, status: 200, postings: postings.filter((p) => p.externalId && p.title) };
  },

  async probe(token: string): Promise<ProbeResult> {
    const coords = parseWorkdayToken(token);
    if (!coords) return { found: false, count: 0 };

    const response = await postJson(apiUrl(coords), { limit: 1, offset: 0, searchText: '' });
    const page = response.body as WorkdayPage;
    if (!response.ok || !Array.isArray(page?.jobPostings)) return { found: false, count: 0 };
    return { found: true, count: page.total ?? page.jobPostings.length };
  },

  async fetchDescription(ref: CompanyRef, posting: RawPosting): Promise<string> {
    const coords = parseWorkdayToken(ref.token);
    if (!coords || !posting.applyUrl) return '';

    const path = posting.applyUrl.split(coords.site)[1] ?? '';
    if (!path) return '';

    const response = await getJson(
      `https://${coords.tenant}.${coords.host}.myworkdayjobs.com/wday/cxs/${coords.tenant}/${coords.site}${path}`,
    );
    if (!response.ok) return '';

    const info = (response.body as { jobPostingInfo?: { jobDescription?: string } })?.jobPostingInfo;
    return boundDescription(stripHtml(info?.jobDescription ?? ''));
  },
};
