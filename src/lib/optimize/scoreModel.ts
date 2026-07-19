// src/lib/optimize/scoreModel.ts
// The internal score model for Optimize results. Turns raw store state into one
// explicit, testable presentation object so ScoreHeader, ScoreDiffBreakdown and the
// companion all read the SAME semantics and can never fork the formula.
//
// Four score concepts, kept strictly separate (never overloaded onto one field):
//   baselineScore                   — verified current score of the user's resume
//                                     (the Match baseline chain; source of truth).
//   currentAppliedProjection        — estimate for the suggestions the user has
//                                     actually applied (actionable-only ratio).
//   allSuggestionsPotentialEstimate — AI estimate if every actionable suggestion
//                                     were applied (baseline + improvement).
//   verifiedAllSuggestionsScore     — genuine re-score of the resume with all
//                                     actionable suggestions applied. A target, not
//                                     the current score; valid only while its
//                                     signature matches the live card set. Verified
//                                     no-change and decrease outcomes never fabricate
//                                     an upward projection.
import type { OptimizationMetrics, OptimizationResult } from '@/types/templates';
import { partitionOptimizations } from '@/lib/optimize/actionability';

export type VerifiedOutcome = 'improved' | 'no_change' | 'decreased';

/**
 * Display states describe the score source and whether the verified potential
 * has become the current score by applying every actionable suggestion.
 */
export type DisplayState =
  | 'current'
  | 'estimated_applied'
  | 'verified_potential'
  | 'verified_applied'
  | 'verified_no_change'
  | 'verified_decreased';

/** Typed verification-anomaly state shared by OptimizeSection and ScoreHeader. */
export type VerifyAnomalyKind = 'too_short' | 'no_text_change' | 'anomalous_drop' | 'error';
export interface VerifyAnomalyState {
  kind: VerifyAnomalyKind;
  rawScore: number | null;
  textLength: number;
  /** Set for no_text_change: how many actionable cards failed to merge. */
  mergeFailedCount?: number;
}

/** |verified − baseline| ≤ band ⇒ no_change. */
export const NO_CHANGE_BAND = 3;
/** Minimum estimated improvement (points) for an estimate to be worth showing. */
export const MIN_MEANINGFUL_ESTIMATE = 1;

export type VerifiedPotential = NonNullable<OptimizationMetrics['verifiedPotential']>;

export interface ScorePresentationCounts {
  actionableTotal: number;
  /** Applied actionable cards that did not fail to merge. */
  actionableApplied: number;
  recommendationTotal: number;
  /** Actionable cards whose content-based merge failed (never counted as progress). */
  mergeFailed: number;
}

export interface ScorePresentation {
  baselineScore: number | null;
  currentAppliedProjection: number | null;
  allSuggestionsPotentialEstimate: number | null;
  verifiedAllSuggestionsScore: number | null;
  verifiedOutcome: VerifiedOutcome | null;
  displayState: DisplayState;
  /** Optional second score rendered beside the baseline score. */
  arrowTarget: number | null;
  /** True only when arrowTarget came from a genuine verification run. */
  arrowIsVerified: boolean;
  isPlaceholderScore: boolean;
  /** True when the estimate is a real zero (0 points predicted), not merely absent. */
  estimateIsZero: boolean;
  counts: ScorePresentationCounts;
}

const clampScore = (value: number): number => Math.min(100, Math.max(0, value));

export function classifyVerifiedOutcome(verified: number, baseline: number): VerifiedOutcome {
  const delta = verified - baseline;
  if (delta > NO_CHANGE_BAND) return 'improved';
  if (delta < -NO_CHANGE_BAND) return 'decreased';
  return 'no_change';
}

// FNV-1a — matches the store's cache-key hashing approach; works with Arabic.
const fnv1a = (input: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const cardText = (value: OptimizationResult['optimized']): string =>
  Array.isArray(value) ? value.join('\n') : String(value ?? '');

/**
 * Invalidation key for a verified potential: the actionable card set (ids + their
 * optimized text), the resume text and the job description. Refining a card,
 * re-generating, or changing resume/JD all shift the signature so a stale verified
 * potential is dropped at read time. Applying/reverting does NOT shift it — the
 * potential remains a valid target while the user works through the cards.
 */
export function verificationSignature(
  actionable: readonly OptimizationResult[],
  resumeText: string,
  jobDescription: string,
): string {
  const cards = actionable
    .map((o) => `${o.sectionId}::${cardText(o.optimized)}`)
    .sort()
    .join('|');
  return `${fnv1a(cards)}-${fnv1a(resumeText)}-${fnv1a(jobDescription)}`;
}

export interface ScorePresentationInput {
  optimizations: readonly OptimizationResult[];
  /** Resolved via the existing baseline priority chain (may be null = placeholder). */
  baselineScore: number | null;
  /** Generation-time estimate if all actionable suggestions applied (never the verified delta). */
  improvement: number | null;
  verifiedPotential: OptimizationMetrics['verifiedPotential'] | undefined;
  resumeText: string;
  jobDescription: string;
}

export function buildScorePresentation(input: ScorePresentationInput): ScorePresentation {
  const { actionable, recommendations } = partitionOptimizations(input.optimizations);

  const actionableTotal = actionable.length;
  const mergeFailed = actionable.filter((o) => o.mergeStatus === 'failed').length;
  const actionableApplied = actionable.filter((o) => o.applied && o.mergeStatus !== 'failed').length;

  const baseline = input.baselineScore;
  const isPlaceholderScore = baseline === null;

  const improvement = input.improvement;

  // A verified potential only counts while its signature matches the live card set.
  let verifiedAllSuggestionsScore: number | null = null;
  let verifiedOutcome: VerifiedOutcome | null = null;
  const vp = input.verifiedPotential;
  if (vp && baseline !== null && actionableTotal > 0) {
    const liveSignature = verificationSignature(actionable, input.resumeText, input.jobDescription);
    if (vp.signature === liveSignature) {
      verifiedAllSuggestionsScore = clampScore(vp.score);
      verifiedOutcome = vp.outcome;
    }
  }

  const verifiedDelta = verifiedAllSuggestionsScore !== null && baseline !== null
    ? verifiedAllSuggestionsScore - baseline
    : null;
  const effectiveImprovement = verifiedDelta ?? improvement;
  const estimateMeaningful = effectiveImprovement !== null
    && effectiveImprovement >= MIN_MEANINGFUL_ESTIMATE;
  const generationEstimateMeaningful = improvement !== null
    && improvement >= MIN_MEANINGFUL_ESTIMATE;
  const estimateIsZero = improvement === 0 && verifiedDelta === null;

  const currentAppliedProjection =
    baseline !== null && actionableTotal > 0 && actionableApplied > 0 && estimateMeaningful
      ? clampScore(baseline + Math.round((effectiveImprovement as number) * (actionableApplied / actionableTotal)))
      : null;

  const allSuggestionsPotentialEstimate =
    baseline !== null && generationEstimateMeaningful ? clampScore(baseline + (improvement as number)) : null;

  let displayState: DisplayState;
  if (verifiedOutcome === 'decreased') {
    displayState = 'verified_decreased';
  } else if (verifiedOutcome === 'no_change') {
    displayState = 'verified_no_change';
  } else if (verifiedOutcome === 'improved') {
    const allActionableApplied = actionableTotal > 0 && actionableApplied === actionableTotal;
    displayState = allActionableApplied ? 'verified_applied' : 'verified_potential';
  } else if (actionableApplied > 0 && estimateMeaningful && baseline !== null) {
    displayState = 'estimated_applied';
  } else {
    displayState = 'current';
  }

  const arrowTarget = displayState === 'verified_applied'
    ? verifiedAllSuggestionsScore
    : (displayState === 'estimated_applied' || displayState === 'verified_potential')
      ? currentAppliedProjection
      : null;
  const arrowIsVerified = displayState === 'verified_applied';

  return {
    baselineScore: baseline,
    currentAppliedProjection,
    allSuggestionsPotentialEstimate,
    verifiedAllSuggestionsScore,
    verifiedOutcome,
    displayState,
    arrowTarget,
    arrowIsVerified,
    isPlaceholderScore,
    estimateIsZero,
    counts: {
      actionableTotal,
      actionableApplied,
      recommendationTotal: recommendations.length,
      mergeFailed,
    },
  };
}
