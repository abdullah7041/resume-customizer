import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScoreDiffBreakdown } from '../components/ScoreDiffBreakdown';
import { buildScorePresentation, classifyVerifiedOutcome, verificationSignature } from '../lib/optimize/scoreModel';
import { partitionOptimizations } from '../lib/optimize/actionability';
import type { OptimizationResult } from '../types/templates';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts === 'object' && !('count' in opts)) {
        // interpolate {{x}} tokens so we can assert on numbers
        let out = key;
        for (const [k, v] of Object.entries(opts)) out += `|${k}=${v}`;
        return out;
      }
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

const trackScoreDiffExpanded = vi.fn();
vi.mock('../services/analytics', () => ({
  analytics: {
    trackScoreDiffExpanded: (...args: unknown[]) => trackScoreDiffExpanded(...args),
  },
}));

afterEach(() => {
  cleanup();
  trackScoreDiffExpanded.mockClear();
});

const opt = (id: string, applied: boolean, original = 'Worked on things'): OptimizationResult => ({
  sectionId: id,
  sectionType: 'experience',
  original,
  optimized: 'Improved thing',
  applied,
});

const RESUME_TEXT = 'resume text';
const JD_TEXT = 'jd text';

const present = (
  optimizations: OptimizationResult[],
  {
    baseline = 60,
    improvement = 20,
    verified = null,
  }: { baseline?: number | null; improvement?: number | null; verified?: number | null } = {},
) => {
  const verifiedPotential = verified !== null && baseline !== null
    ? {
      score: verified,
      baselineAtVerify: baseline,
      signature: verificationSignature(partitionOptimizations(optimizations).actionable, RESUME_TEXT, JD_TEXT),
      verifiedAt: Date.now(),
      outcome: classifyVerifiedOutcome(verified, baseline),
    }
    : null;
  return buildScorePresentation({
    optimizations,
    baselineScore: baseline,
    improvement,
    verifiedPotential,
    resumeText: RESUME_TEXT,
    jobDescription: JD_TEXT,
  });
};

const renderDiff = (
  optimizations: OptimizationResult[],
  scoreOpts: Parameters<typeof present>[1] = {},
) => {
  const presentation = present(optimizations, scoreOpts);
  return render(
    <ScoreDiffBreakdown
      presentation={presentation}
      improvement={scoreOpts.improvement === undefined ? 20 : scoreOpts.improvement}
      optimizations={optimizations}
    />,
  );
};

const baseCards = [opt('a', true), opt('b', false), opt('c', true)];

describe('ScoreDiffBreakdown', () => {
  it('reports only applied:true cards as counted in the projection', () => {
    renderDiff(baseCards);
    fireEvent.click(screen.getByRole('button', { name: /showCards|hideCards/i }));
    // 2 of 3 applied
    expect(
      screen.getByText((c) => c.includes('applied=2') && c.includes('total=3'))
    ).toBeInTheDocument();
    expect(screen.getAllByText('sections.optimize.scoreDiff.counted')).toHaveLength(2);
    expect(screen.getAllByText('sections.optimize.scoreDiff.notCounted')).toHaveLength(1);
  });

  it('shows the estimate badge and note when not verified', () => {
    renderDiff(baseCards);
    expect(screen.getByText('sections.optimize.scoreDiff.estimateBadge')).toBeInTheDocument();
    expect(screen.getByText('sections.optimize.scoreDiff.estimateNote')).toBeInTheDocument();
    expect(screen.queryByText('sections.optimize.scoreDiff.verifiedBadge')).not.toBeInTheDocument();
  });

  it('shows the verified badge and note only when everything actionable is applied', () => {
    const allApplied = [opt('a', true), opt('b', true), opt('c', true)];
    renderDiff(allApplied, { verified: 78 });
    expect(screen.getByText('sections.optimize.scoreDiff.verifiedBadge')).toBeInTheDocument();
    expect(screen.getByText('sections.optimize.scoreDiff.verifiedNote')).toBeInTheDocument();
    // The verified score is the arrow target: 78%
    expect(screen.getByText('78%')).toBeInTheDocument();
  });

  it('keeps a partially-applied verified potential separate from the current score', () => {
    renderDiff(baseCards, { verified: 78 });
    // Arrow shows the applied-only projection, not the verified potential…
    expect(screen.getByText('sections.optimize.scoreDiff.estimateBadge')).toBeInTheDocument();
    // …and the verified potential appears as its own labeled line.
    expect(
      screen.getByText((c) => c.includes('verifiedPotentialLine') && c.includes('score=78'))
    ).toBeInTheDocument();
  });

  it('shows the equal-share legend as improvement/actionableTotal to one decimal', () => {
    renderDiff(baseCards);
    // 20 / 3 = 6.7
    expect(
      screen.getByText((c) => c.includes('perCardShare') && c.includes('points=6.7'))
    ).toBeInTheDocument();
  });

  it('excludes recommendation-only cards from totals and lists them separately', () => {
    const mixed = [
      ...baseCards,
      { ...opt('skills-0', false), sectionType: 'skills' as const, optimized: 'TypeScript, Kubernetes' },
      { ...opt('certifications-0', false), sectionType: 'certifications' as const, optimized: 'CISSP (ISC2)' },
    ];
    renderDiff(mixed);
    // Totals stay actionable-only (2 of 3, not 2 of 5)…
    expect(
      screen.getByText((c) => c.includes('applied=2') && c.includes('total=3'))
    ).toBeInTheDocument();
    // …share stays improvement/actionable (6.7, not 20/5=4.0)…
    expect(
      screen.getByText((c) => c.includes('perCardShare') && c.includes('points=6.7'))
    ).toBeInTheDocument();
    // …and recommendations get their own aside + expanded section.
    expect(
      screen.getByText((c) => c.includes('recommendationsAside') && c.includes('total=2'))
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /showCards|hideCards/i }));
    expect(screen.getByText('sections.optimize.scoreDiff.recommendationsHeading')).toBeInTheDocument();
    expect(screen.getAllByText('sections.optimize.scoreDiff.recommendationLabel')).toHaveLength(2);
  });

  it('marks merge-failed cards and never counts them', () => {
    const cards = [
      { ...opt('a', true) },
      { ...opt('b', false), mergeStatus: 'failed' as const },
    ];
    renderDiff(cards);
    fireEvent.click(screen.getByRole('button', { name: /showCards|hideCards/i }));
    expect(screen.getByText('sections.optimize.scoreDiff.mergeFailed')).toBeInTheDocument();
    expect(
      screen.getByText((c) => c.includes('applied=1') && c.includes('total=1'))
    ).toBeInTheDocument();
  });

  it('shows the noneApplied message and no fabricated gain when zero applied', () => {
    renderDiff([opt('a', false), opt('b', false)]);
    expect(screen.getByText('sections.optimize.scoreDiff.noneApplied')).toBeInTheDocument();
  });

  it('hides the equal-share and potential lines for a zero estimate', () => {
    renderDiff([opt('a', false), opt('b', false)], { baseline: 10, improvement: 0 });
    expect(screen.queryByText((c) => c.includes('perCardShare'))).not.toBeInTheDocument();
    expect(screen.queryByText((c) => c.includes('potentialNote'))).not.toBeInTheDocument();
    expect(screen.getByText('sections.optimize.scoreDiff.noGainPredicted')).toBeInTheDocument();
  });

  it('renders an em-dash for placeholder score without fabricating a number', () => {
    renderDiff(baseCards, { baseline: null, improvement: null });
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    // no equal-share legend when improvement is a placeholder
    expect(
      screen.queryByText((c) => c.includes('perCardShare'))
    ).not.toBeInTheDocument();
  });

  it('fires a metadata-only analytics event when the breakdown is expanded', () => {
    renderDiff(baseCards);
    fireEvent.click(screen.getByRole('button', { name: /showCards|hideCards/i }));
    expect(trackScoreDiffExpanded).toHaveBeenCalledTimes(1);
    const payload = trackScoreDiffExpanded.mock.calls[0][0];
    expect(payload).toMatchObject({ appliedCount: 2, totalCount: 3, isVerified: false });
    expect(JSON.stringify(payload)).not.toContain('Worked on things');
  });
});
