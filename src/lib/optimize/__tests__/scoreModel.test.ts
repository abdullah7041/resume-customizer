import { describe, expect, it } from 'vitest';
import {
  MIN_MEANINGFUL_ESTIMATE,
  NO_CHANGE_BAND,
  appliedVerificationSignature,
  buildScorePresentation,
  classifyVerifiedOutcome,
  verificationSignature,
} from '../scoreModel';
import { partitionOptimizations } from '../actionability';
import type { OptimizationResult } from '@/types/templates';

const card = (over: Partial<OptimizationResult> & { sectionId: string }): OptimizationResult => ({
  sectionType: 'experience',
  original: `orig ${over.sectionId}`,
  optimized: `opt ${over.sectionId}`,
  applied: false,
  ...over,
});

/** 3 actionable + 2 recommendation-only cards. */
const mixedQueue = (appliedActionable: number): OptimizationResult[] => [
  card({ sectionId: 'experience-0', applied: appliedActionable > 0 }),
  card({ sectionId: 'summary-0', sectionType: 'summary', applied: appliedActionable > 1 }),
  card({ sectionId: 'headline-0', sectionType: 'headline', applied: appliedActionable > 2 }),
  card({ sectionId: 'skills-0', sectionType: 'skills' }),
  card({ sectionId: 'certifications-0', sectionType: 'certifications' }),
];

const verifiedFor = (
  optimizations: OptimizationResult[],
  score: number,
  baseline: number,
  over: Partial<NonNullable<Parameters<typeof buildScorePresentation>[0]['verifiedPotential']>> = {},
) => ({
  score,
  baselineAtVerify: baseline,
  signature: verificationSignature(partitionOptimizations(optimizations).actionable, 'resume text', 'jd text'),
  verifiedAt: Date.now(),
  outcome: classifyVerifiedOutcome(score, baseline),
  ...over,
});

const verifiedAppliedFor = (
  optimizations: OptimizationResult[],
  score: number,
  baseline: number,
) => ({
  score,
  baselineAtVerify: baseline,
  appliedSignature: appliedVerificationSignature(partitionOptimizations(optimizations).actionable, 'resume text', 'jd text'),
  verifiedAt: Date.now(),
  appliedCount: partitionOptimizations(optimizations).actionable.filter((o) => o.applied).length,
});

const present = (
  optimizations: OptimizationResult[],
  {
    baseline = 10,
    improvement = null,
    verifiedPotential = null,
    verifiedApplied = null,
  }: {
    baseline?: number | null;
    improvement?: number | null;
    verifiedPotential?: Parameters<typeof buildScorePresentation>[0]['verifiedPotential'];
    verifiedApplied?: Parameters<typeof buildScorePresentation>[0]['verifiedApplied'];
  } = {},
) =>
  buildScorePresentation({
    optimizations,
    baselineScore: baseline,
    improvement,
    verifiedPotential,
    verifiedApplied,
    resumeText: 'resume text',
    jobDescription: 'jd text',
  });

describe('classifyVerifiedOutcome', () => {
  it('classifies around the ±NO_CHANGE_BAND boundary', () => {
    expect(classifyVerifiedOutcome(10 + NO_CHANGE_BAND, 10)).toBe('no_change');
    expect(classifyVerifiedOutcome(10 + NO_CHANGE_BAND + 1, 10)).toBe('improved');
    expect(classifyVerifiedOutcome(10 - NO_CHANGE_BAND, 10)).toBe('no_change');
    expect(classifyVerifiedOutcome(10 - NO_CHANGE_BAND - 1, 10)).toBe('decreased');
    expect(classifyVerifiedOutcome(10, 10)).toBe('no_change');
  });
});

describe('counts (actionable vs recommendation)', () => {
  it('separates actionable and recommendation cards and never mixes denominators', () => {
    const p = present(mixedQueue(2), { improvement: 10 });
    expect(p.counts).toEqual({
      actionableTotal: 3,
      actionableApplied: 2,
      recommendationTotal: 2,
      mergeFailed: 0,
    });
  });

  it('excludes merge-failed cards from the applied numerator', () => {
    const queue = mixedQueue(0);
    queue[0] = { ...queue[0], applied: true, mergeStatus: 'failed' as const };
    const p = present(queue, { improvement: 10 });
    expect(p.counts.actionableApplied).toBe(0);
    expect(p.counts.mergeFailed).toBe(1);
  });

  it('ignores applied flags on recommendation cards (legacy persisted state)', () => {
    const queue = mixedQueue(0).map((c) =>
      c.sectionType === 'skills' || c.sectionType === 'certifications' ? { ...c, applied: true } : c,
    );
    const p = present(queue, { improvement: 10 });
    expect(p.counts.actionableApplied).toBe(0);
    expect(p.displayState).toBe('current');
  });
});

describe('display states', () => {
  it('State A: nothing applied — no projection, potential shown separately', () => {
    const p = present(mixedQueue(0), { improvement: 12 });
    expect(p.displayState).toBe('current');
    expect(p.currentAppliedProjection).toBeNull();
    expect(p.allSuggestionsPotentialEstimate).toBe(22);
    expect(p.arrowTarget).toBeNull();
    expect(p.arrowIsVerified).toBe(false);
  });

  it('State A with a zero estimate: estimateIsZero is a real zero, not a placeholder', () => {
    const p = present(mixedQueue(0), { improvement: 0 });
    expect(p.displayState).toBe('current');
    expect(p.estimateIsZero).toBe(true);
    expect(p.allSuggestionsPotentialEstimate).toBeNull();
    expect(p.currentAppliedProjection).toBeNull();
  });

  it('State B: partial applied with meaningful estimate uses the ACTIONABLE ratio', () => {
    const p = present(mixedQueue(2), { improvement: 12 });
    expect(p.displayState).toBe('estimated_applied');
    // 10 + round(12 × 2/3) = 18 — recommendations must not dilute the ratio (2/5 would give 15).
    expect(p.currentAppliedProjection).toBe(18);
    expect(p.arrowTarget).toBe(18);
    expect(p.arrowIsVerified).toBe(false);
  });

  it('State B never triggers without a meaningful estimate', () => {
    expect(present(mixedQueue(2), { improvement: 0 }).displayState).toBe('current');
    expect(present(mixedQueue(2), { improvement: null }).displayState).toBe('current');
    expect(present(mixedQueue(2), { improvement: MIN_MEANINGFUL_ESTIMATE }).displayState).toBe('estimated_applied');
  });

  it('State C: verified improved potential stays separate from the current score', () => {
    const queue = mixedQueue(0);
    const p = present(queue, { improvement: 12, verifiedPotential: verifiedFor(queue, 25, 10) });
    expect(p.displayState).toBe('verified_potential');
    expect(p.baselineScore).toBe(10);
    expect(p.verifiedAllSuggestionsScore).toBe(25);
    expect(p.currentAppliedProjection).toBeNull(); // current resume unchanged
    expect(p.arrowTarget).toBeNull();
    expect(p.arrowIsVerified).toBe(false);
  });

  it('State C_ALL: verified improved and every actionable card applied', () => {
    const queue = mixedQueue(3);
    const p = present(queue, { improvement: 12, verifiedPotential: verifiedFor(queue, 25, 10) });
    expect(p.displayState).toBe('verified_applied');
    expect(p.verifiedAllSuggestionsScore).toBe(25);
    expect(p.arrowTarget).toBe(25);
    expect(p.arrowIsVerified).toBe(true);
  });

  it('State D: verified no-change beats any estimate', () => {
    const queue = mixedQueue(1);
    const p = present(queue, { improvement: 12, verifiedPotential: verifiedFor(queue, 10, 10) });
    expect(p.displayState).toBe('verified_no_change');
    expect(p.verifiedOutcome).toBe('no_change');
  });

  it('State E: verified decrease', () => {
    const queue = mixedQueue(3);
    const p = present(queue, { improvement: 12, verifiedPotential: verifiedFor(queue, 4, 10) });
    expect(p.displayState).toBe('verified_decreased');
    expect(p.verifiedOutcome).toBe('decreased');
  });

  it('placeholder baseline forces State A and null projections', () => {
    const p = present(mixedQueue(2), { baseline: null, improvement: 12 });
    expect(p.displayState).toBe('current');
    expect(p.isPlaceholderScore).toBe(true);
    expect(p.currentAppliedProjection).toBeNull();
    expect(p.allSuggestionsPotentialEstimate).toBeNull();
    expect(p.verifiedAllSuggestionsScore).toBeNull();
  });
});

describe('verification signature invalidation', () => {
  it('a stale verified potential is dropped when a card is refined', () => {
    const queue = mixedQueue(0);
    const vp = verifiedFor(queue, 25, 10);
    const refined = queue.map((c) =>
      c.sectionId === 'experience-0' ? { ...c, optimized: 'refined text' } : c,
    );
    const p = present(refined, { improvement: 12, verifiedPotential: vp });
    expect(p.verifiedAllSuggestionsScore).toBeNull();
    expect(p.displayState).toBe('current');
  });

  it('survives apply/revert (applied flags are not part of the signature)', () => {
    const queue = mixedQueue(0);
    const vp = verifiedFor(queue, 25, 10);
    const p = present(mixedQueue(2), { improvement: 12, verifiedPotential: vp });
    expect(p.verifiedAllSuggestionsScore).toBe(25);
    expect(p.displayState).toBe('verified_potential');
  });

  it('is invalidated by a resume or JD change', () => {
    const queue = mixedQueue(0);
    const vp = verifiedFor(queue, 25, 10);
    const changedJd = buildScorePresentation({
      optimizations: queue,
      baselineScore: 10,
      improvement: 12,
      verifiedPotential: vp,
      resumeText: 'resume text',
      jobDescription: 'DIFFERENT jd',
    });
    expect(changedJd.verifiedAllSuggestionsScore).toBeNull();
  });
});

describe('projection math', () => {
  it('projects a valid verified all-actionable delta across the applied cards', () => {
    const queue = [
      card({ sectionId: 'experience-0', applied: true }),
      card({ sectionId: 'summary-0', sectionType: 'summary' }),
    ];
    const verifiedPotential = {
      score: 78,
      baselineAtVerify: 60,
      outcome: 'improved' as const,
      signature: verificationSignature(partitionOptimizations(queue).actionable, 'resume text', 'jd text'),
      verifiedAt: Date.now(),
    };

    const p = present(queue, { baseline: 60, improvement: null, verifiedPotential });

    // 60 + round((78 - 60) * 1/2) = 69
    expect(p.currentAppliedProjection).toBe(69);
  });

  it('keeps a zero generation estimate current only while nothing is applied', () => {
    const queue = mixedQueue(0);
    const p = present(queue, { improvement: 0 });

    expect(p.displayState).toBe('current');
    expect(p.currentAppliedProjection).toBeNull();
    expect(p.allSuggestionsPotentialEstimate).toBeNull();
    expect(p.estimateIsZero).toBe(true);
    expect(p.appliedVerificationPending).toBe(false);
  });

  it('never settles on a zero estimate once cards are applied — a genuine re-score is owed', () => {
    // The frozen-header bug: improvement 0, cards applied, no verification.
    // The truth is "recalculation pending", never "no gain predicted".
    const queue = mixedQueue(1);
    const p = present(queue, { improvement: 0 });

    expect(p.displayState).toBe('current');
    expect(p.currentAppliedProjection).toBeNull();
    expect(p.estimateIsZero).toBe(false);
    expect(p.appliedVerificationPending).toBe(true);
  });

  it('climbs monotonically to the verified target without counting recommendations', () => {
    const originalQueue = [
      card({ sectionId: 'experience-0' }),
      card({ sectionId: 'summary-0', sectionType: 'summary' }),
      card({ sectionId: 'skills-0', sectionType: 'skills', applied: true }),
    ];
    const verifiedPotential = verifiedFor(originalQueue, 78, 60);
    const oneApplied = originalQueue.map((entry, index) => index === 0 ? { ...entry, applied: true } : entry);
    const allApplied = oneApplied.map((entry) => entry.sectionType === 'summary' ? { ...entry, applied: true } : entry);

    expect(present(originalQueue, { baseline: 60, verifiedPotential }).currentAppliedProjection).toBeNull();
    expect(present(oneApplied, { baseline: 60, verifiedPotential }).currentAppliedProjection).toBe(69);
    expect(present(allApplied, { baseline: 60, verifiedPotential }).currentAppliedProjection).toBe(78);
    expect(present(allApplied, { baseline: 60, verifiedPotential }).counts.actionableApplied).toBe(2);
  });

  it('does not project merge-failed cards from a verified target', () => {
    const queue = [
      card({ sectionId: 'experience-0', applied: true, mergeStatus: 'failed' }),
      card({ sectionId: 'summary-0', sectionType: 'summary' }),
    ];
    const p = present(queue, { baseline: 60, verifiedPotential: verifiedFor(queue, 78, 60) });

    expect(p.counts.actionableApplied).toBe(0);
    expect(p.currentAppliedProjection).toBeNull();
  });

  it('excludes merge-failed cards from the verified projection denominator', () => {
    const queue = [
      card({ sectionId: 'experience-0', applied: true }),
      card({ sectionId: 'summary-0', sectionType: 'summary', mergeStatus: 'failed' }),
    ];
    const p = present(queue, { baseline: 60, verifiedPotential: verifiedFor(queue, 78, 60) });

    expect(p.counts.actionableTotal).toBe(1);
    expect(p.counts.actionableApplied).toBe(1);
    expect(p.currentAppliedProjection).toBe(78);
    expect(p.displayState).toBe('verified_applied');
  });

  it('keeps verified no-change frozen even when a card is applied', () => {
    const queue = [
      card({ sectionId: 'experience-0', applied: true }),
      card({ sectionId: 'summary-0', sectionType: 'summary' }),
    ];
    const p = present(queue, { baseline: 60, improvement: null, verifiedPotential: verifiedFor(queue, 60, 60) });

    expect(p.displayState).toBe('verified_no_change');
    expect(p.currentAppliedProjection).toBeNull();
  });

  it('clamps to 0-100', () => {
    const p = present(mixedQueue(3), { baseline: 95, improvement: 30 });
    expect(p.currentAppliedProjection).toBe(100);
    expect(p.allSuggestionsPotentialEstimate).toBe(100);
  });

  it('a verified no-change never overwrites the estimate (separate fields)', () => {
    const queue = mixedQueue(1);
    const p = present(queue, { improvement: 12, verifiedPotential: verifiedFor(queue, 10, 10) });
    // The estimate is still intact and visible in the model even though the
    // verified outcome takes display precedence.
    expect(p.allSuggestionsPotentialEstimate).toBe(22);
    expect(p.displayState).toBe('verified_no_change');
  });
});

describe('applied-subset verification (genuine post-apply score)', () => {
  it('signature shifts when a card is applied or reverted, and when texts change', () => {
    const queue = mixedQueue(1);
    const { actionable } = partitionOptimizations(queue);
    const base = appliedVerificationSignature(actionable, 'resume text', 'jd text');

    const flipped = partitionOptimizations(mixedQueue(2)).actionable;
    expect(appliedVerificationSignature(flipped, 'resume text', 'jd text')).not.toBe(base);
    expect(appliedVerificationSignature(actionable, 'other resume', 'jd text')).not.toBe(base);
    expect(appliedVerificationSignature(actionable, 'resume text', 'other jd')).not.toBe(base);

    const editedCard = actionable.map((o, i) => (i === 0 ? { ...o, optimized: 'rewritten' } : o));
    expect(appliedVerificationSignature(editedCard, 'resume text', 'jd text')).not.toBe(base);
    // A merge-failed card counts as not applied.
    const failed = actionable.map((o) => (o.applied ? { ...o, mergeStatus: 'failed' as const } : o));
    expect(appliedVerificationSignature(failed, 'resume text', 'jd text'))
      .toBe(appliedVerificationSignature(actionable.map((o) => ({ ...o, applied: false, mergeStatus: o.applied ? 'failed' as const : o.mergeStatus })), 'resume text', 'jd text'));
  });

  it('a signature-valid applied verification becomes the displayed verified score', () => {
    const queue = mixedQueue(2);
    const p = present(queue, { baseline: 25, improvement: 0, verifiedApplied: verifiedAppliedFor(queue, 33, 25) });

    expect(p.verifiedAppliedScore).toBe(33);
    expect(p.appliedVerificationPending).toBe(false);
    expect(p.displayState).toBe('verified_applied_partial');
    expect(p.arrowTarget).toBe(33);
    expect(p.arrowIsVerified).toBe(true);
    expect(p.estimateIsZero).toBe(false);
  });

  it('a stale applied verification (card reverted after verify) is dropped and pending returns', () => {
    const verifiedAtTwoApplied = verifiedAppliedFor(mixedQueue(2), 33, 25);
    const p = present(mixedQueue(1), { baseline: 25, improvement: 0, verifiedApplied: verifiedAtTwoApplied });

    expect(p.verifiedAppliedScore).toBeNull();
    expect(p.appliedVerificationPending).toBe(true);
    expect(p.displayState).toBe('current');
  });

  it('all actionable cards applied reuses the valid full-set verification as the current score', () => {
    // The reported 12/12 stuck case: no applied-subset metric yet, but the
    // full-set verification covers the identical merged resume — its score is
    // the genuine current score, at zero extra cost.
    const queue = mixedQueue(3);
    const p = present(queue, { baseline: 25, improvement: 0, verifiedPotential: verifiedFor(queue, 41, 25) });

    expect(p.verifiedAppliedScore).toBe(41);
    expect(p.appliedVerificationPending).toBe(false);
    expect(p.displayState).toBe('verified_applied');
    expect(p.arrowTarget).toBe(41);
    expect(p.arrowIsVerified).toBe(true);
  });

  it('verified full-set no-change keeps banner precedence over an applied verification', () => {
    const queue = mixedQueue(3);
    const p = present(queue, {
      baseline: 25,
      improvement: 0,
      verifiedPotential: verifiedFor(queue, 26, 25),
      verifiedApplied: verifiedAppliedFor(queue, 26, 25),
    });

    expect(p.displayState).toBe('verified_no_change');
    expect(p.appliedVerificationPending).toBe(false);
  });
});
