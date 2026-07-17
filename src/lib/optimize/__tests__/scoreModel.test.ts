import { describe, expect, it } from 'vitest';
import {
  MIN_MEANINGFUL_ESTIMATE,
  NO_CHANGE_BAND,
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

const present = (
  optimizations: OptimizationResult[],
  {
    baseline = 10,
    improvement = null,
    verifiedPotential = null,
  }: {
    baseline?: number | null;
    improvement?: number | null;
    verifiedPotential?: Parameters<typeof buildScorePresentation>[0]['verifiedPotential'];
  } = {},
) =>
  buildScorePresentation({
    optimizations,
    baselineScore: baseline,
    improvement,
    verifiedPotential,
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
    expect(p.displayState).toBe('A');
  });
});

describe('display states', () => {
  it('State A: nothing applied — no projection, potential shown separately', () => {
    const p = present(mixedQueue(0), { improvement: 12 });
    expect(p.displayState).toBe('A');
    expect(p.currentAppliedProjection).toBeNull();
    expect(p.allSuggestionsPotentialEstimate).toBe(22);
  });

  it('State A with a zero estimate: estimateIsZero is a real zero, not a placeholder', () => {
    const p = present(mixedQueue(0), { improvement: 0 });
    expect(p.displayState).toBe('A');
    expect(p.estimateIsZero).toBe(true);
    expect(p.allSuggestionsPotentialEstimate).toBeNull();
    expect(p.currentAppliedProjection).toBeNull();
  });

  it('State B: partial applied with meaningful estimate uses the ACTIONABLE ratio', () => {
    const p = present(mixedQueue(2), { improvement: 12 });
    expect(p.displayState).toBe('B');
    // 10 + round(12 × 2/3) = 18 — recommendations must not dilute the ratio (2/5 would give 15).
    expect(p.currentAppliedProjection).toBe(18);
  });

  it('State B never triggers without a meaningful estimate', () => {
    expect(present(mixedQueue(2), { improvement: 0 }).displayState).toBe('A');
    expect(present(mixedQueue(2), { improvement: null }).displayState).toBe('A');
    expect(present(mixedQueue(2), { improvement: MIN_MEANINGFUL_ESTIMATE }).displayState).toBe('B');
  });

  it('State C: verified improved potential stays separate from the current score', () => {
    const queue = mixedQueue(0);
    const p = present(queue, { improvement: 12, verifiedPotential: verifiedFor(queue, 25, 10) });
    expect(p.displayState).toBe('C');
    expect(p.baselineScore).toBe(10);
    expect(p.verifiedAllSuggestionsScore).toBe(25);
    expect(p.currentAppliedProjection).toBeNull(); // current resume unchanged
  });

  it('State C_ALL: verified improved and every actionable card applied', () => {
    const queue = mixedQueue(3);
    const p = present(queue, { improvement: 12, verifiedPotential: verifiedFor(queue, 25, 10) });
    expect(p.displayState).toBe('C_ALL');
    expect(p.verifiedAllSuggestionsScore).toBe(25);
  });

  it('State D: verified no-change beats any estimate', () => {
    const queue = mixedQueue(1);
    const p = present(queue, { improvement: 12, verifiedPotential: verifiedFor(queue, 10, 10) });
    expect(p.displayState).toBe('D');
    expect(p.verifiedOutcome).toBe('no_change');
  });

  it('State E: verified decrease', () => {
    const queue = mixedQueue(3);
    const p = present(queue, { improvement: 12, verifiedPotential: verifiedFor(queue, 4, 10) });
    expect(p.displayState).toBe('E');
    expect(p.verifiedOutcome).toBe('decreased');
  });

  it('placeholder baseline forces State A and null projections', () => {
    const p = present(mixedQueue(2), { baseline: null, improvement: 12 });
    expect(p.displayState).toBe('A');
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
    expect(p.displayState).toBe('A');
  });

  it('survives apply/revert (applied flags are not part of the signature)', () => {
    const queue = mixedQueue(0);
    const vp = verifiedFor(queue, 25, 10);
    const p = present(mixedQueue(2), { improvement: 12, verifiedPotential: vp });
    expect(p.verifiedAllSuggestionsScore).toBe(25);
    expect(p.displayState).toBe('C');
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
    expect(p.displayState).toBe('D');
  });
});
