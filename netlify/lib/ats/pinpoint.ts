// Pinpoint job-board API: one flat `data` array, no pagination, no publish date.
// The only date field is `deadline_at` and it is null, so `postedAt` stays null and
// ordering falls back to when we first saw the posting. The JD is split across
// three fields and has to be concatenated.

import { boundDescription, getJson, isPlainToken, stripHtml } from './http.js';
import type { AtsProvider, CompanyRef, FetchOutcome, ProbeResult, RawPosting } from './types.js';

interface PinpointJob {
  id?: string | number;
  title?: string;
  url?: string;
  location?: { city?: string; name?: string };
  description?: string;
  key_responsibilities?: string;
  skills_knowledge_expertise?: string;
}

const JD_FIELDS = ['description', 'key_responsibilities', 'skills_knowledge_expertise'] as const;

const postingsUrl = (token: string) => `https://${token}.pinpointhq.com/postings.json`;

export const pinpoint: AtsProvider = {
  source: 'pinpoint',

  // A subdomain, so stricter than the shared guard: no dots.
  isValidToken: (token) => isPlainToken(token) && !token.includes('.'),

  async fetchPostings(ref: CompanyRef): Promise<FetchOutcome> {
    const response = await getJson(postingsUrl(ref.token));
    if (!response.ok) {
      return { ok: false, status: response.status, postings: [], error: response.error };
    }

    const jobs = (response.body as { data?: PinpointJob[] })?.data;
    if (!Array.isArray(jobs)) {
      return { ok: false, status: 200, postings: [], error: 'unexpected pinpoint payload' };
    }

    const postings: RawPosting[] = jobs.map((job) => ({
      externalId: String(job.id ?? ''),
      title: (job.title ?? '').trim(),
      // City plus country, so a Saudi match works on either part ("KSA" appears here).
      location: [job.location?.city, job.location?.name].filter(Boolean).join(', '),
      applyUrl: job.url ?? '',
      postedAt: null,
      description: boundDescription(
        JD_FIELDS.map((field) => stripHtml(job[field] ?? '')).join('\n').trim(),
      ),
    }));

    return { ok: true, status: 200, postings: postings.filter((p) => p.externalId && p.title) };
  },

  async probe(token: string): Promise<ProbeResult> {
    if (!pinpoint.isValidToken(token)) return { found: false, count: 0 };
    const response = await getJson(postingsUrl(token));
    const jobs = (response.body as { data?: unknown[] })?.data;
    if (!response.ok || !Array.isArray(jobs)) return { found: false, count: 0 };
    return { found: true, count: jobs.length };
  },
};
