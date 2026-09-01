import { describe, expect, it } from 'vitest';
import { lastBoardCheck } from '@/lib/jobs/boardFreshness';
import type { TrackedCompany } from '@/services/jobFeed';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function tracked(overrides: Partial<TrackedCompany> = {}): TrackedCompany {
  return {
    companyId: 'c1',
    displayName: 'Salla',
    source: 'workable',
    token: 'salla',
    trackedSince: minutesAgo(60 * 24 * 30),
    lastFetchedAt: minutesAgo(60),
    lastStatus: 'ok',
    lastJobCount: 27,
    ...overrides,
  };
}

describe('lastBoardCheck', () => {
  it('reports the oldest check, so the line cannot claim more freshness than every board has', () => {
    // "Boards last checked a minute ago" over a set where one board was last read
    // five days ago is the same overstatement as timing the database re-read: the
    // number has to be true of the whole feed, not of its luckiest company.
    const oldest = minutesAgo(60 * 24 * 5);
    const checked = lastBoardCheck([
      tracked({ lastFetchedAt: minutesAgo(1) }),
      tracked({ companyId: 'c2', lastFetchedAt: oldest }),
    ]);

    expect(checked).toBe(Date.parse(oldest));
  });

  it('ignores the stamp a failed crawl leaves behind', () => {
    // A failed fetch stamps last_fetched_at too, to stop a broken token being
    // retried every run. Nothing was read, so nothing was checked.
    const read = minutesAgo(120);
    const checked = lastBoardCheck([
      tracked({ lastStatus: 'failed', lastFetchedAt: minutesAgo(1) }),
      tracked({ companyId: 'c2', lastFetchedAt: read }),
    ]);

    expect(checked).toBe(Date.parse(read));
  });

  it('has nothing to report when no board has been read', () => {
    expect(lastBoardCheck([tracked({ lastFetchedAt: null })])).toBeNull();
    expect(lastBoardCheck([tracked({ lastStatus: 'failed' })])).toBeNull();
    expect(lastBoardCheck([])).toBeNull();
  });

  it('survives a timestamp it cannot parse rather than reporting NaN', () => {
    const read = minutesAgo(30);
    expect(lastBoardCheck([tracked({ lastFetchedAt: 'not a date' }), tracked({ companyId: 'c2', lastFetchedAt: read })]))
      .toBe(Date.parse(read));
  });
});
