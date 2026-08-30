// Lever v0 postings API: GET, returns a flat JSON array. `createdAt` is epoch-ms.

import { boundDescription, getJson, isPlainToken, stripHtml } from './http.js';
import type { AtsProvider, CompanyRef, FetchOutcome, ProbeResult, RawPosting } from './types.js';

interface LeverJob {
  id?: string;
  text?: string;
  categories?: { location?: string };
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  descriptionPlain?: string;
  description?: string;
}

const postingsUrl = (token: string) =>
  `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`;

export const lever: AtsProvider = {
  source: 'lever',

  isValidToken: isPlainToken,

  async fetchPostings(ref: CompanyRef): Promise<FetchOutcome> {
    const response = await getJson(postingsUrl(ref.token));
    if (!response.ok) {
      return { ok: false, status: response.status, postings: [], error: response.error };
    }
    if (!Array.isArray(response.body)) {
      return { ok: false, status: 200, postings: [], error: 'unexpected lever payload' };
    }

    const postings: RawPosting[] = (response.body as LeverJob[]).map((job) => ({
      externalId: String(job.id ?? ''),
      title: (job.text ?? '').trim(),
      location: (job.categories?.location ?? '').trim(),
      applyUrl: job.hostedUrl ?? job.applyUrl ?? '',
      postedAt:
        typeof job.createdAt === 'number' ? new Date(job.createdAt).toISOString() : null,
      description: boundDescription(
        (job.descriptionPlain ?? stripHtml(job.description ?? '')).trim(),
      ),
    }));

    return { ok: true, status: 200, postings: postings.filter((p) => p.externalId && p.title) };
  },

  async probe(token: string): Promise<ProbeResult> {
    if (!isPlainToken(token)) return { found: false, count: 0 };
    const response = await getJson(postingsUrl(token));
    if (!response.ok || !Array.isArray(response.body)) return { found: false, count: 0 };
    return { found: true, count: response.body.length };
  },
};
