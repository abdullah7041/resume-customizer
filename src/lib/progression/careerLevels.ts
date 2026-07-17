// src/lib/progression/careerLevels.ts
// Deterministic career-level progression derived from the 0-100 Match score. This is
// the ONE score→level mapping in the app: both the Match and Optimize companion
// variants consume it, so the two sections can never disagree about a level.
//
// Five levels span 0-100. The character art has three tiers
// (src/assets/character/{male,female}-tier-{1,2,3}.webp); art changes only at the
// established 60/80 boundaries — 40 and 70 are level-ups within the same art tier.
// The score remains the single source of truth: there is no separate XP value and
// nothing here is persisted.

export type CharacterArtTier = 'struggling' | 'confident' | 'celebrating';

export interface CareerLevel {
  index: 1 | 2 | 3 | 4 | 5;
  /** i18n suffix under sections.characterResults.levels.* */
  key: 'foundation' | 'builder' | 'candidate' | 'competitor' | 'frontRunner';
  /** Inclusive score bounds. */
  min: number;
  max: number;
  artTier: CharacterArtTier;
}

export const CAREER_LEVELS: readonly CareerLevel[] = [
  { index: 1, key: 'foundation', min: 0, max: 39, artTier: 'struggling' },
  { index: 2, key: 'builder', min: 40, max: 59, artTier: 'struggling' },
  { index: 3, key: 'candidate', min: 60, max: 69, artTier: 'confident' },
  { index: 4, key: 'competitor', min: 70, max: 79, artTier: 'confident' },
  { index: 5, key: 'frontRunner', min: 80, max: 100, artTier: 'celebrating' },
];

const clampScore = (score: number): number => Math.min(100, Math.max(0, Math.round(score)));

/** Level for a 0-100 score (clamped; non-finite input maps to level 1). */
export function getCareerLevel(score: number): CareerLevel {
  const clamped = Number.isFinite(score) ? clampScore(score) : 0;
  return CAREER_LEVELS.find((level) => clamped >= level.min && clamped <= level.max) ?? CAREER_LEVELS[0];
}

/**
 * True when moving from `fromScore` to `toScore` crosses at least one level
 * boundary upward. Null scores never level up (no celebration without real data).
 */
export function getLevelUp(fromScore: number | null, toScore: number | null): boolean {
  if (fromScore === null || toScore === null) return false;
  if (!Number.isFinite(fromScore) || !Number.isFinite(toScore)) return false;
  return getCareerLevel(toScore).index > getCareerLevel(fromScore).index;
}
