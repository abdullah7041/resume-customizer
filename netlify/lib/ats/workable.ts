// Workable v3 board API: POST, 10 jobs per page, cursor returned as `nextPage` and
// echoed back as `{"token": ...}`. There is no apply URL in the payload, so the
// canonical one is built from the shortcode.
//
// Descriptions are not in the list payload. The v1 widget endpoint returns them
// for the whole account in one call, so the JD still costs one request per
// company rather than one per job.

import { boundDescription, getJson, isPlainToken, postJson, stripHtml } from './http.js';
import type { AtsProvider, CompanyRef, FetchOutcome, ProbeResult, RawPosting } from './types.js';

interface WorkableJob {
  id?: string | number;
  shortcode?: string;
  title?: string;
  /** Verified live 2026-08-29: the v3 list field is `published`, not `published_on`. */
  published?: string;
  state?: string;
  location?: { city?: string; country?: string };
}

interface WorkablePage {
  /** Verified live 2026-08-29: v3 returns `results`, not `jobs`. */
  results?: WorkableJob[];
  total?: number;
  nextPage?: string;
}

const MAX_PAGES = 20;

const listUrl = (token: string) =>
  `https://apply.workable.com/api/v3/accounts/${encodeURIComponent(token)}/jobs`;

const widgetUrl = (token: string) =>
  `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(token)}?details=true`;

export const workable: AtsProvider = {
  source: 'workable',

  isValidToken: isPlainToken,

  async fetchPostings(ref: CompanyRef): Promise<FetchOutcome> {
    const collected: WorkableJob[] = [];
    let cursor: string | undefined;
    let pages = 0;

    do {
      const response = await postJson(listUrl(ref.token), cursor ? { token: cursor } : {});
      if (!response.ok) {
        return { ok: false, status: response.status, postings: [], error: response.error };
      }

      const page = response.body as WorkablePage;
      if (!Array.isArray(page?.results)) {
        return { ok: false, status: 200, postings: [], error: 'unexpected workable payload' };
      }

      collected.push(...page.results);
      cursor = page.nextPage;
      pages += 1;
    } while (cursor && pages < MAX_PAGES);

    const descriptions = await fetchDescriptions(ref.token);

    const postings: RawPosting[] = collected.map((job) => ({
      externalId: String(job.shortcode ?? job.id ?? ''),
      title: (job.title ?? '').trim(),
      location: [job.location?.city, job.location?.country].filter(Boolean).join(', '),
      applyUrl: job.shortcode
        ? `https://apply.workable.com/${ref.token}/j/${job.shortcode}/`
        : '',
      postedAt: normalizeDate(job.published),
      description: descriptions.get(String(job.shortcode ?? '')) ?? '',
    }));

    return { ok: true, status: 200, postings: postings.filter((p) => p.externalId && p.title) };
  },

  async probe(token: string): Promise<ProbeResult> {
    if (!isPlainToken(token)) return { found: false, count: 0 };
    const response = await postJson(listUrl(token), {});
    if (!response.ok) return { found: false, count: 0 };
    const body = response.body as WorkablePage;
    if (typeof body?.total !== 'number' && !Array.isArray(body?.results)) {
      return { found: false, count: 0 };
    }
    return { found: true, count: body.total ?? body.results?.length ?? 0 };
  },
};

/** One widget call per company; a failure just means titles-only for this run. */
async function fetchDescriptions(token: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const response = await getJson(widgetUrl(token));
  if (!response.ok) return map;

  const jobs = (response.body as { jobs?: { shortcode?: string; description?: string }[] })?.jobs;
  if (!Array.isArray(jobs)) return map;

  for (const job of jobs) {
    if (!job.shortcode) continue;
    map.set(job.shortcode, boundDescription(stripHtml(job.description ?? '')));
  }
  return map;
}

function normalizeDate(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
