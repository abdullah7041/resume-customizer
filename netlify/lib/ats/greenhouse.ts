// Greenhouse job-board API.
//
// There is a SINGLE global API host. `boards-api.eu.greenhouse.io` does not
// resolve (NXDOMAIN, confirmed live) — the `.eu.` prefix exists only on the
// front-end board URL, so EU-hosted boards like Tamara serve from the same host
// and there is no region to configure.
//
// `content=true` returns every description in the list call, which is why the
// description costs one request per company here rather than one per job.

import { boundDescription, getJson, isPlainToken, stripHtml } from './http.js';
import type { AtsProvider, CompanyRef, FetchOutcome, ProbeResult, RawPosting } from './types.js';

interface GreenhouseJob {
  id?: number | string;
  title?: string;
  location?: { name?: string };
  absolute_url?: string;
  first_published?: string;
  updated_at?: string;
  content?: string;
}

const listUrl = (token: string, withContent: boolean) =>
  `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=${withContent}`;

export const greenhouse: AtsProvider = {
  source: 'greenhouse',

  isValidToken: isPlainToken,

  async fetchPostings(ref: CompanyRef): Promise<FetchOutcome> {
    const response = await getJson(listUrl(ref.token, true));
    if (!response.ok) {
      return { ok: false, status: response.status, postings: [], error: response.error };
    }

    const jobs = (response.body as { jobs?: GreenhouseJob[] })?.jobs;
    if (!Array.isArray(jobs)) {
      return { ok: false, status: 200, postings: [], error: 'unexpected greenhouse payload' };
    }

    const postings: RawPosting[] = jobs.map((job) => ({
      externalId: String(job.id ?? ''),
      title: (job.title ?? '').trim(),
      location: (job.location?.name ?? '').trim(),
      applyUrl: job.absolute_url ?? '',
      postedAt: normalizeDate(job.first_published ?? job.updated_at),
      description: boundDescription(stripHtml(job.content ?? '')),
    }));

    return { ok: true, status: 200, postings: postings.filter((p) => p.externalId && p.title) };
  },

  async probe(token: string): Promise<ProbeResult> {
    if (!isPlainToken(token)) return { found: false, count: 0 };
    const response = await getJson(listUrl(token, false));
    const jobs = (response.body as { jobs?: unknown[] })?.jobs;
    if (!response.ok || !Array.isArray(jobs)) return { found: false, count: 0 };
    return { found: true, count: jobs.length };
  },
};

function normalizeDate(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
