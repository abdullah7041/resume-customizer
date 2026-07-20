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
  | 'verified_applied_partial'
  | 'verified_no_change'
  | 'verified_decreased';

/**
 * Lifecycle of the applied-subset re-verification, shared by OptimizeSection
 * and ScoreHeader. 'guest' = signed-out user, auto-verify intentionally skipped.
 */
export type AppliedVerifyStatus = 'idle' | 'pending' | 'failed' | 'guest';

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
  /**
   * Genuine re-score of the resume with ONLY the currently applied cards
   * merged (signature-checked). When all actionable cards are applied it
   * reuses the valid all-suggestions verification — same merged resume.
   */
  verifiedAppliedScore: number | null;
  /**
   * True when cards are applied but no genuine re-score covers the current
   * applied set yet — the UI owes the user a recalculation, and must never
   * present the baseline (or a zero estimate) as a settled answer.
   */
  appliedVerificationPending: boolean;
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

/**
 * Invalidation key for an applied-subset verification. Unlike
 * `verificationSignature`, each card also contributes its applied bit — WHICH
 * cards are applied is the whole point, so applying or reverting any card
 * shifts the signature and forces a fresh re-score of the new subset.
 * Merge-failed cards always contribute '0' (they never merge).
 */
export function appliedVerificationSignature(
  actionable: readonly OptimizationResult[],
  resumeText: string,
  jobDescription: string,
): string {
  const cards = actionable
    .map((o) => `${o.sectionId}::${o.applied && o.mergeStatus !== 'failed' ? '1' : '0'}::${cardText(o.optimized)}`)
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
  verifiedApplied?: OptimizationMetrics['verifiedApplied'] | undefined;
  resumeText: string;
  jobDescription: string;
}

export function buildScorePresentation(input: ScorePresentationInput): ScorePresentation {
  const { actionable, recommendations } = partitionOptimizations(input.optimizations);
  const actionableForProjection = actionable.filter((o) => o.mergeStatus !== 'failed');

  const actionableTotal = actionableForProjection.length;
  const mergeFailed = actionable.filter((o) => o.mergeStatus === 'failed').length;
  const actionableApplied = actionableForProjection.filter((o) => o.applied).length;

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
  // A zero estimate is only a settled "current" statement while nothing is
  // applied — once cards are applied the truth is a genuine re-score (or the
  // fact that one is still pending), never "no gain predicted".
  const estimateIsZero = improvement === 0 && verifiedDelta === null && actionableApplied === 0;

  const allActionableApplied = actionableTotal > 0 && actionableApplied === actionableTotal;

  // Genuine score of the CURRENT applied subset. Sources, in order:
  //   1. An applied-subset verification whose signature matches the live set.
  //   2. When ALL actionable cards are applied, the valid all-suggestions
  //      verification — the merged resume is identical, so its score is the
  //      current score, not merely a target.
  let verifiedAppliedScore: number | null = null;
  const va = input.verifiedApplied;
  if (va && baseline !== null && actionableApplied > 0) {
    const liveAppliedSignature = appliedVerificationSignature(actionable, input.resumeText, input.jobDescription);
    if (va.appliedSignature === liveAppliedSignature) {
      verifiedAppliedScore = clampScore(va.score);
    }
  }
  if (verifiedAppliedScore === null && allActionableApplied && verifiedAllSuggestionsScore !== null) {
    verifiedAppliedScore = verifiedAllSuggestionsScore;
  }

  const appliedVerificationPending = actionableApplied > 0 && verifiedAppliedScore === null;

  const currentAppliedProjection =
    baseline !== null && actionableTotal > 0 && actionableApplied > 0 && estimateMeaningful
      ? clampScore(baseline + Math.round((effectiveImprovement as number) * (actionableApplied / actionableTotal)))
      : null;

  const allSuggestionsPotentialEstimate =
    baseline !== null && generationEstimateMeaningful ? clampScore(baseline + (improvement as number)) : null;

  let displayState: DisplayState;
  // The verified no-change/decrease banners keep precedence — applying cards
  // must never hide the honest "rewording will not move this match" verdict.
  if (verifiedOutcome === 'decreased') {
    displayState = 'verified_decreased';
  } else if (verifiedOutcome === 'no_change') {
    displayState = 'verified_no_change';
  } else if (verifiedAppliedScore !== null) {
    displayState = allActionableApplied ? 'verified_applied' : 'verified_applied_partial';
  } else if (verifiedOutcome === 'improved') {
    displayState = allActionableApplied ? 'verified_applied' : 'verified_potential';
  } else if (actionableApplied > 0 && estimateMeaningful && baseline !== null) {
    displayState = 'estimated_applied';
  } else {
    displayState = 'current';
  }

  const arrowTarget = (displayState === 'verified_applied' || displayState === 'verified_applied_partial')
    ? (verifiedAppliedScore ?? verifiedAllSuggestionsScore)
    : (displayState === 'estimated_applied' || displayState === 'verified_potential')
      ? currentAppliedProjection
      : null;
  const arrowIsVerified = displayState === 'verified_applied' || displayState === 'verified_applied_partial';

  return {
    baselineScore: baseline,
    currentAppliedProjection,
    allSuggestionsPotentialEstimate,
    verifiedAllSuggestionsScore,
    verifiedAppliedScore,
    appliedVerificationPending,
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
