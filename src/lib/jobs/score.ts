// Deterministic scoring, ported from digest.py:737 (`keyword_score`).
//
// No model runs here. The crawler cannot see a resume — nothing is stored
// server-side — so ranking is intent-driven and computed at read time, which also
// means changing your target role re-ranks the feed with no re-crawl.

import { matchedRoleTerms } from './normalize';
import { deriveRoleTerms, dropReason } from './filters';
import type { FeedIntent, FeedPosting, FeedResult, ScoredPosting } from './types';

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
export function buildFeed(postings: readonly FeedPosting[], intent: FeedIntent): FeedResult {
  const roleTerms = deriveRoleTerms(intent.targetRoles);
  const kept: ScoredPosting[] = [];
  const dropped: FeedResult['dropped'] = [];

  for (const posting of postings) {
    const reason = dropReason(posting, intent);
    if (reason) {
      dropped.push({ posting, reason });
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
