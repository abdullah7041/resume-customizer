// Provider registry. The crawler and the resolver dispatch through here so
// neither ever branches on source.

import { ashby } from './ashby.js';
import { greenhouse } from './greenhouse.js';
import { lever } from './lever.js';
import { pinpoint } from './pinpoint.js';
import { workable } from './workable.js';
import { workday } from './workday.js';
import type { AtsProvider, AtsSource, CompanyRef, FetchOutcome } from './types.js';

/** Providers that can be probed by a bare company handle. */
export const NAME_PROBEABLE: AtsProvider[] = [greenhouse, ashby, workable, lever, pinpoint];

/** Workday is resolved from a pasted careers URL — a tenant alone cannot name a site. */
export const URL_ONLY: AtsProvider[] = [workday];

export const PROVIDERS: Record<string, AtsProvider> = Object.fromEntries(
  [...NAME_PROBEABLE, ...URL_ONLY].map((provider) => [provider.source, provider]),
);

export function getProvider(source: AtsSource): AtsProvider | null {
  return PROVIDERS[source] ?? null;
}

/**
 * Read one company's board. Never throws: an unknown source or an invalid token is
 * an unsuccessful outcome, not an exception, so one bad row cannot end a crawl run.
 */
export async function fetchCompany(ref: CompanyRef): Promise<FetchOutcome> {
  const provider = getProvider(ref.source);
  if (!provider) {
    return { ok: false, status: null, postings: [], error: `unknown source ${ref.source}` };
  }
  if (!provider.isValidToken(ref.token)) {
    return { ok: false, status: null, postings: [], error: 'invalid token' };
  }

  try {
    return await provider.fetchPostings(ref);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'fetch failed';
    return { ok: false, status: null, postings: [], error: message };
  }
}

export { ashby, greenhouse, lever, pinpoint, workable, workday };
export * from './types.js';
