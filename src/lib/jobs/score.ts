// Deterministic scoring, ported from digest.py:737 (`keyword_score`).
//
// No model runs here. The crawler cannot see a resume — nothing is stored
// server-side — so ranking is intent-driven and computed at read time, which also
// means changing your target role re-ranks the feed with no re-crawl.

import { matchedRoleTerms } from './normalize';
import { deriveRoleTerms, dropReason } from './filters';
import { withinAgeWindow } from './age';
import type { FeedIntent, FeedPosting, FeedResult, ScoredPosting } from './types';

export interface BuildFeedOptions {
  /** Hide dated postings older than this. Undated boards are never filtered — see `age.ts`. */
  maxAgeDays?: number;
  /** Injectable clock, so the window is testable without faking timers. */
  now?: number;
}

/** Clearing the hard filters is worth this much on its own. */
export const BASE_SCORE = 40;

/** Each distinct intent term the title supports. */
export const TERM_WEIGHT = 15;

export const MAX_SCORE = 100;

export function scorePosting(posting: FeedPosting, roleTerms: readonly string[]): ScoredPosting {
  const matched = matchedRoleTerms(posting.title, roleTerms);
  const score = Math.min(MAX_SCORE, BASE_SCORE + matched.length * TERM_WEIGHT);
  return { posting, score, matched };
}

/**
 * Filter, score, and rank a batch of postings. Dropped postings are returned with
 * their reason rather than silently discarded — an empty feed must be able to say
 * which rule emptied it.
 */
export function buildFeed(
  postings: readonly FeedPosting[],
  intent: FeedIntent,
  options: BuildFeedOptions = {},
): FeedResult {
  const roleTerms = deriveRoleTerms(intent.targetRoles);
  const { maxAgeDays, now = Date.now() } = options;
  const kept: ScoredPosting[] = [];
  const dropped: FeedResult['dropped'] = [];

  for (const posting of postings) {
    const reason = dropReason(posting, intent);
    if (reason) {
      dropped.push({ posting, reason });
      continue;
    }
    // Age runs last, so a role that was never wanted reports why it was never
    // wanted. Telling someone their Dubai job is "too old" hides the real rule.
    if (maxAgeDays !== undefined && !withinAgeWindow(posting, maxAgeDays, now)) {
      dropped.push({ posting, reason: 'age' });
      continue;
    }
    kept.push(scorePosting(posting, roleTerms));
  }

  kept.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aDate = a.posting.postedAt ?? a.posting.firstSeenAt;
    const bDate = b.posting.postedAt ?? b.posting.firstSeenAt;
    return bDate.localeCompare(aDate);
  });

  return { kept, dropped };
}

/**
 * The two-clause "new" predicate. A single last-seen timestamp is not enough: track
 * a company with 60 roles posted over the past year and every one of them reads as
 * new on first open. The first clause suppresses that backfill flood.
 */
export function isNew(
  posting: FeedPosting,
  trackedSince: string,
  lastFeedSeenAt: string | null,
): boolean {
  if (posting.firstSeenAt <= trackedSince) return false;
  if (lastFeedSeenAt && posting.firstSeenAt <= lastFeedSeenAt) return false;
  return true;
}

/** How much of one target role a title covers, in that role's own terms. */
export interface RoleCoverage {
  /** The target role this title covered best, in the user's own wording. */
  role: string;
  matched: string[];
  /** Terms that role derives. Never zero — a role with none is skipped. */
  total: number;
}

/**
 * The target role a title covers best, measured against that role alone.
 *
 * Ranking uses the union of every intent term, which is right for ordering: a
 * title carrying four of the user's words beats one carrying two. It is wrong for
 * telling the user how well a role fits, because the union of "AI Engineer" and
 * "Data Scientist" is four terms no single posting can ever hold — so a perfect
 * AI Engineer match read as half a match, and every row was depressed by however
 * many roles the user happened to type.
 */
export function bestRoleCoverage(title: string, targetRoles: readonly string[]): RoleCoverage | null {
  let best: RoleCoverage | null = null;

  for (const role of targetRoles) {
    const terms = deriveRoleTerms([role]);
    if (terms.length === 0) continue;

    const candidate: RoleCoverage = { role, matched: matchedRoleTerms(title, terms), total: terms.length };
    if (!best || candidate.matched.length / candidate.total > best.matched.length / best.total) {
      best = candidate;
    }
  }

  return best;
}
