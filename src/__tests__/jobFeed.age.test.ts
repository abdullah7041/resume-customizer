import { describe, expect, it } from 'vitest';
import { postingAge, DEFAULT_MAX_AGE_DAYS } from '@/lib/jobs/age';
import { buildFeed } from '@/lib/jobs/score';
import type { FeedIntent, FeedPosting } from '@/lib/jobs/types';

const NOW = Date.parse('2026-08-31T12:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

function posting(overrides: Partial<FeedPosting> = {}): FeedPosting {
  return {
    id: 'p1',
    companyId: 'c1',
    companyName: 'Salla',
    title: 'Senior AI Engineer',
    location: 'Riyadh, Saudi Arabia',
    applyUrl: 'https://apply.workable.com/salla/j/ABC/',
    postedAt: daysAgo(2),
    firstSeenAt: daysAgo(2),
    ...overrides,
  };
}

const intent: FeedIntent = { targetRoles: ['Senior AI Engineer'], seniority: 'senior' };

describe('postingAge', () => {
  it('reports a real posting date as posted', () => {
    const age = postingAge(posting({ postedAt: daysAgo(3) }), NOW);
    expect(age).toMatchObject({ kind: 'posted', days: 3 });
  });

  it('falls back to first-seen, under a different name, when the board publishes no date', () => {
    // Pinpoint and Workday never emit a posting date. Calling the crawler's own
    // first sighting "posted" would be a claim about the employer we cannot make.
    const age = postingAge(posting({ postedAt: null, firstSeenAt: daysAgo(5) }), NOW);
    expect(age).toMatchObject({ kind: 'seen', days: 5 });
  });

  it('treats an unparseable posting date as no date at all', () => {
    const age = postingAge(posting({ postedAt: 'not-a-date', firstSeenAt: daysAgo(1) }), NOW);
    expect(age).toMatchObject({ kind: 'seen', days: 1 });
  });

  it('reports unknown, with no date to show, when neither timestamp can be read', () => {
    const age = postingAge(posting({ postedAt: null, firstSeenAt: 'not-a-date' }), NOW);
    expect(age).toEqual({ kind: 'unknown', iso: null, days: 0 });
  });

  it('never reports negative age for a board whose clock runs ahead', () => {
    expect(postingAge(posting({ postedAt: daysAgo(-2) }), NOW).days).toBe(0);
  });
});

describe('age filtering in buildFeed', () => {
  it('keeps everything when no window is given', () => {
    const old = posting({ id: 'old', postedAt: daysAgo(200), firstSeenAt: daysAgo(200) });
    expect(buildFeed([old], intent).kept).toHaveLength(1);
  });

  it('drops a dated posting older than the window, and names the rule', () => {
    const old = posting({ id: 'old', postedAt: daysAgo(30), firstSeenAt: daysAgo(30) });

    const feed = buildFeed([old], intent, { maxAgeDays: DEFAULT_MAX_AGE_DAYS, now: NOW });

    expect(feed.kept).toHaveLength(0);
    expect(feed.dropped).toEqual([{ posting: old, reason: 'age' }]);
  });

  it('keeps a posting from a board that publishes no dates, however old it is', () => {
    // Tabby is the largest verified board in the starter registry and Pinpoint
    // gives it no dates. A window that tests first-seen would delete it entirely.
    const undated = posting({ id: 'tabby', postedAt: null, firstSeenAt: daysAgo(120) });

    const feed = buildFeed([undated], intent, { maxAgeDays: DEFAULT_MAX_AGE_DAYS, now: NOW });

    expect(feed.kept.map((scored) => scored.posting.id)).toEqual(['tabby']);
  });

  it('keeps a posting inside the window', () => {
    const fresh = posting({ id: 'fresh', postedAt: daysAgo(1) });
    expect(buildFeed([fresh], intent, { maxAgeDays: 7, now: NOW }).kept).toHaveLength(1);
  });

  it('lets the hard filters answer first, so age never masks the real reason', () => {
    const elsewhere = posting({
      id: 'dubai',
      location: 'Dubai, UAE',
      postedAt: daysAgo(90),
      firstSeenAt: daysAgo(90),
    });

    const feed = buildFeed([elsewhere], intent, { maxAgeDays: 7, now: NOW });

    expect(feed.dropped[0].reason).toBe('location');
  });
});
