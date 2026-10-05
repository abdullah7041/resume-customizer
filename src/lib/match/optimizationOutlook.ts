// src/lib/match/optimizationOutlook.ts
// Pure classifier for "is optimizing this match worth the credit spend?" — a
// qualitative band, never a fabricated predicted score. Built entirely from
// strategicRealityCheck.confirmedRisks/riskTier, which are populated in
// production; matchAnalysis.keywordStrategy/gapAnalysis are not and must not
// be depended on here.
import type { StrategicRealityCheck } from '@/types/analysis';

export type FitPotentialBand = 'high' | 'medium' | 'low';
export type OptimizationOutlookBand = 'high_potential' | 'worth_it_with_gaps' | 'low_ceiling';

export interface OptimizationOutlook {
  band: OptimizationOutlookBand;
  fitPotential: FitPotentialBand;
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

  const hasCriticalRisk = confirmedRisks.some((risk) => risk.severity === 'critical');
  const hasHighOrCriticalRisk = confirmedRisks.some(
    (risk) => risk.severity === 'high' || risk.severity === 'critical',
  );
  const recommendation = realityCheck?.recommendation ?? null;

  let band: OptimizationOutlookBand;
  if (
    score < 60
    || hasCriticalRisk
    || riskTier === 'critical'
    || recommendation === 'review_role_fit'
  ) {
    band = 'low_ceiling';
  } else if (score >= 80 && !hasHighOrCriticalRisk) {
    band = 'high_potential';
  } else {
    band = 'worth_it_with_gaps';
  }

  const fitPotential: FitPotentialBand = band === 'high_potential'
    ? 'high'
    : band === 'worth_it_with_gaps'
      ? 'medium'
      : 'low';

  return { band, fitPotential, blockers };
}
