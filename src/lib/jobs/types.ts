// Shared types for the Job Feed. Filtering and scoring run in the browser, next
// to the resume and the search intent — nothing here is persisted per user.

export type Seniority = 'junior' | 'mid' | 'senior' | 'lead' | 'manager';

/** One crawled posting, as the feed reads it. Never carries the job description. */
export interface FeedPosting {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  location: string;
  applyUrl: string;
  postedAt: string | null;
  firstSeenAt: string;
}

/** The user's intent, as the filters consume it. */
export interface FeedIntent {
  targetRoles: string[];
  seniority?: Seniority;
  locations?: string[];
}

export type FeedDropReason = 'location' | 'location_conflict' | 'seniority' | 'role' | 'age';

export interface ScoredPosting {
  posting: FeedPosting;
  score: number;
  /** Which intent terms the title supported — the deterministic "why this surfaced". */
  matched: string[];
}

export interface DroppedPosting {
  posting: FeedPosting;
  reason: FeedDropReason;
}

export interface FeedResult {
  kept: ScoredPosting[];
  dropped: DroppedPosting[];
}
