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

import type { FeedPosting } from './types';

/** The feed's default window: recent enough to act on, wide enough to be non-empty. */
export const DEFAULT_MAX_AGE_DAYS = 7;

export type PostingAgeKind = 'posted' | 'seen';

export interface PostingAge {
  /** `posted` means the employer's own date. `seen` means our first sighting. */
  kind: PostingAgeKind;
  iso: string;
  /** Whole days elapsed, floored, never negative. */
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
  if (posted !== null) {
    return { kind: 'posted', iso: posting.postedAt as string, days: elapsedDays(posted, now) };
  }

  const seen = parse(posting.firstSeenAt);
  return {
    kind: 'seen',
    iso: posting.firstSeenAt,
    days: seen === null ? 0 : elapsedDays(seen, now),
  };
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
  const age = postingAge(posting, now);
  if (age.kind !== 'posted') return true;
  return age.days <= maxAgeDays;
}
