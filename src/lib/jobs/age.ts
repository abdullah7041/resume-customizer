// How old a posting is, and — just as important — which date that age came from.
//
// Half the boards we read publish a posting date and half do not: Greenhouse,
// Ashby, Workable and the jsonld reader emit one; Pinpoint (Tabby, the largest
// verified board in the starter registry) and Workday never do. For those, the
// only timestamp we hold is `firstSeenAt`, which records when the crawler first
// saw the row — not when the employer posted it. On the first crawl of a newly
// followed company that is today for every role on the board, including ones
// posted eight months ago.
//
// So `kind` travels with the number. A first sighting is never presented as a
// posting date, and the age window never tests one.

import type { FeedPosting } from './types.js';

/** The default is an exact, verified 24-hour publication window. */
export const DEFAULT_MAX_AGE_DAYS = 1;

export type PostingAgeKind = 'posted' | 'seen' | 'unknown';

export interface PostingAge {
  /**
   * `posted` is the employer's own date, `seen` our first sighting, `unknown`
   * means neither timestamp could be read. `unknown` carries no number to show:
   * printing "today" for a date we just failed to parse would invent one.
   */
  kind: PostingAgeKind;
  iso: string | null;
  /** Whole days elapsed, floored, never negative. Meaningless when `unknown`. */
  days: number;
}

function parse(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function elapsedDays(from: number, now: number): number {
  return Math.max(0, Math.floor((now - from) / 86_400_000));
}

export function postingAge(posting: FeedPosting, now: number = Date.now()): PostingAge {
  const posted = parse(posting.postedAt);
  if (posted !== null && posting.publicationKind !== 'unknown') {
    return { kind: 'posted', iso: posting.postedAt as string, days: elapsedDays(posted, now) };
  }

  const seen = parse(posting.firstSeenAt);
  if (seen === null) return { kind: 'unknown', iso: null, days: 0 };

  return { kind: 'seen', iso: posting.firstSeenAt, days: elapsedDays(seen, now) };
}

/**
 * Whether a posting survives the age window.
 *
 * Only a real posting date is tested. A posting from a board that publishes no
 * dates is always kept — filtering it on `firstSeenAt` would either pass
 * everything (first crawl) or delete a whole employer's board, and neither
 * outcome answers the question the window is asking.
 */
export function withinAgeWindow(posting: FeedPosting, maxAgeDays: number, now: number = Date.now()): boolean {
  if (maxAgeDays === 1) {
    const published = parse(posting.postedAt);
    return posting.publicationKind === 'published'
      && posting.publicationPrecision === 'timestamp'
      && /T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(posting.postedAt ?? '')
      && published !== null && published <= now && now - published < 86_400_000;
  }
  const age = postingAge(posting, now);
  if (age.kind !== 'posted') return true;
  return age.days <= maxAgeDays;
}
