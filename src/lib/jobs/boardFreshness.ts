// When the followed boards were last actually read.
//
// Kept apart from the feed's own clock on purpose. "Updated just now" times the
// database re-read, which the Reload button does; this times the crawl, which
// runs once a day on a schedule no button here can trigger.

import type { TrackedCompany } from '@/services/jobFeed';

export interface CrawlRequest { companyIds: string[]; requestedAt: string }
export function crawlProgress(request: CrawlRequest, companies: readonly Pick<TrackedCompany, 'companyId' | 'lastFetchedAt' | 'lastStatus'>[]) {
  const finished = companies.filter((company) => request.companyIds.includes(company.companyId) && company.lastStatus !== 'pending' && Date.parse(company.lastFetchedAt ?? '') >= Date.parse(request.requestedAt));
  const succeeded = finished.filter((company) => company.lastStatus === 'ok').length;
  const failed = finished.length - succeeded;
  const pending = request.companyIds.length - finished.length;
  const status = pending > 0 ? 'queued' : failed === 0 ? 'completed' : succeeded > 0 ? 'partial' : 'failed';
  return { status, succeeded, failed, pending } as const;
}

/**
 * The oldest successful check across the followed boards, or `null` when none has
 * been read.
 *
 * The oldest rather than the newest: the sentence is about the feed, so it has to
 * be true of every company in it. Reporting the freshest board would say "checked
 * a minute ago" over a set where one employer was last read five days ago —
 * exactly the overstatement this line was added to remove.
 *
 * A failed crawl is not a check. `crawl-jobs-background` stamps `last_fetched_at`
 * alongside `last_status: 'failed'` so a broken token is not retried on every run,
 * and reading that stamp as freshness credits a fetch that returned nothing.
 */
export function lastBoardCheck(companies: readonly TrackedCompany[]): number | null {
  const stamps = companies
    .filter((company) => company.lastStatus === 'ok')
    .map((company) => (company.lastFetchedAt ? Date.parse(company.lastFetchedAt) : Number.NaN))
    .filter((value) => !Number.isNaN(value));

  return stamps.length > 0 ? Math.min(...stamps) : null;
}
