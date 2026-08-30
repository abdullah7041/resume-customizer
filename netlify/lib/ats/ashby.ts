// Ashby job-board API. `descriptionPlain` ships in the board payload, so the JD
// costs nothing extra. Unlisted jobs must be skipped — they are still in the feed.

import { boundDescription, getJson, isPlainToken, stripHtml } from './http.js';
import type { AtsProvider, CompanyRef, FetchOutcome, ProbeResult, RawPosting } from './types.js';

interface AshbyJob {
  id?: string;
  title?: string;
  location?: string;
  jobUrl?: string;
  applyUrl?: string;
  publishedAt?: string;
  isListed?: boolean;
  descriptionPlain?: string;
  descriptionHtml?: string;
}

const boardUrl = (token: string) =>
  `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}?includeCompensation=true`;

export const ashby: AtsProvider = {
  source: 'ashby',

  isValidToken: isPlainToken,

  async fetchPostings(ref: CompanyRef): Promise<FetchOutcome> {
    const response = await getJson(boardUrl(ref.token));
    if (!response.ok) {
      return { ok: false, status: response.status, postings: [], error: response.error };
    }

    const jobs = (response.body as { jobs?: AshbyJob[] })?.jobs;
    if (!Array.isArray(jobs)) {
      return { ok: false, status: 200, postings: [], error: 'unexpected ashby payload' };
    }

    const postings: RawPosting[] = jobs
      .filter((job) => job.isListed !== false)
      .map((job) => ({
        externalId: String(job.id ?? ''),
        title: (job.title ?? '').trim(),
        // Ashby's location is a plain string, not an object.
        location: (job.location ?? '').trim(),
        applyUrl: job.jobUrl ?? job.applyUrl ?? '',
        postedAt: job.publishedAt ? new Date(job.publishedAt).toISOString() : null,
        description: boundDescription(
          (job.descriptionPlain ?? stripHtml(job.descriptionHtml ?? '')).trim(),
        ),
      }));

    return { ok: true, status: 200, postings: postings.filter((p) => p.externalId && p.title) };
  },

  async probe(token: string): Promise<ProbeResult> {
    if (!isPlainToken(token)) return { found: false, count: 0 };
    const response = await getJson(boardUrl(token));
    const jobs = (response.body as { jobs?: unknown[] })?.jobs;
    if (!response.ok || !Array.isArray(jobs)) return { found: false, count: 0 };
    return { found: true, count: jobs.length };
  },
};
