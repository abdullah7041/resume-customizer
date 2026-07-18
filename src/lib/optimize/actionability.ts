// src/lib/optimize/actionability.ts
// Single source of truth for whether an optimization card can genuinely modify the
// resume ("actionable") or is advice the user must act on themselves
// ("recommendation"). Skills and certifications are recommendation-only by product
// rule: Watheq never inserts skills/certifications the user has not confirmed they
// hold, so those cards get no Apply controls, never count toward applied progress or
// score projection, and never participate in verification's temporary apply-all.
//
// Every consumer (store apply actions, OptimizeSection counts/projection,
// JobGroupCard controls, ScoreDiffBreakdown, companion progression, verification)
// must classify through this module — never with local sectionType string checks.
import type { OptimizationResult } from '@/types/templates';

export type SectionActionability = 'actionable' | 'recommendation';

export const RECOMMENDATION_ONLY_SECTION_TYPES: ReadonlySet<OptimizationResult['sectionType']> =
  new Set(['skills', 'certifications']);

/**
 * Classify a section type. `general` (legacy fallback cards, headline/summary
 * shaped) is treated as actionable.
 */
export function getActionability(
  sectionType: OptimizationResult['sectionType'] | 'general',
): SectionActionability {
  return RECOMMENDATION_ONLY_SECTION_TYPES.has(sectionType as OptimizationResult['sectionType'])
    ? 'recommendation'
    : 'actionable';
}

export function isActionable(opt: Pick<OptimizationResult, 'sectionType'>): boolean {
  return getActionability(opt.sectionType) === 'actionable';
}

export function isRecommendationOnly(opt: Pick<OptimizationResult, 'sectionType'>): boolean {
  return getActionability(opt.sectionType) === 'recommendation';
}

/** Split a card list into actionable resume edits and recommendation-only cards. */
export function partitionOptimizations<T extends Pick<OptimizationResult, 'sectionType'>>(
  optimizations: readonly T[],
): { actionable: T[]; recommendations: T[] } {
  const actionable: T[] = [];
  const recommendations: T[] = [];
  for (const opt of optimizations) {
    (isActionable(opt) ? actionable : recommendations).push(opt);
  }
  return { actionable, recommendations };
}
