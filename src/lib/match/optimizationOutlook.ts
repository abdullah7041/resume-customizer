// src/lib/match/optimizationOutlook.ts
// Pure classifier for "is optimizing this match worth the credit spend?" — a
// qualitative band, never a fabricated predicted score. Built entirely from
// strategicRealityCheck.confirmedRisks/riskTier, which are populated in
// production; matchAnalysis.keywordStrategy/gapAnalysis are not and must not
// be depended on here.
import type { StrategicRealityCheck } from '@/types/analysis';

export type OptimizationOutlookBand = 'high_potential' | 'worth_it_with_gaps' | 'low_ceiling';

export interface OptimizationOutlook {
  band: OptimizationOutlookBand;
  /** Confirmed-risk titles that cap the outcome, most severe first, capped at 3. */
  blockers: string[];
}

const MAX_BLOCKERS = 3;

/**
 * Classifies whether optimizing is likely to move the needle, from the score
 * and the confirmed/unclear risks already assessed server-side. Returns null
 * when there is no score yet (nothing to classify).
 */
export function computeOptimizationOutlook(
  score: number | null | undefined,
  realityCheck: StrategicRealityCheck | null | undefined
): OptimizationOutlook | null {
  if (score === null || score === undefined || !Number.isFinite(score)) return null;

  const confirmedRisks = realityCheck?.confirmedRisks ?? [];
  const riskTier = realityCheck?.riskTier ?? null;
  const blockers = confirmedRisks.map((risk) => risk.title).slice(0, MAX_BLOCKERS);

  let band: OptimizationOutlookBand;
  if (score < 35 || confirmedRisks.length >= 2 || riskTier === 'critical') {
    band = 'low_ceiling';
  } else if (score >= 55 && confirmedRisks.length === 0) {
    band = 'high_potential';
  } else {
    band = 'worth_it_with_gaps';
  }

  return { band, blockers };
}
