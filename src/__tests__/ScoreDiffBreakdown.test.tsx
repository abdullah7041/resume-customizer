import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScoreDiffBreakdown } from '../components/ScoreDiffBreakdown';
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

const baseProps = {
  beforeScore: 60,
  afterScore: 70,
  potentialScore: 80,
  improvement: 20,
  isScoreVerified: false,
  isPlaceholderScore: false,
  isPlaceholderImprovement: false,
  optimizations: [opt('a', true), opt('b', false), opt('c', true)],
};

describe('ScoreDiffBreakdown', () => {
  it('reports only applied:true cards as counted in the projection', () => {
    render(<ScoreDiffBreakdown {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /showCards|hideCards/i }));
    // 2 of 3 applied
    expect(
      screen.getByText((c) => c.includes('applied=2') && c.includes('total=3'))
    ).toBeInTheDocument();
    expect(screen.getAllByText('sections.optimize.scoreDiff.counted')).toHaveLength(2);
    expect(screen.getAllByText('sections.optimize.scoreDiff.notCounted')).toHaveLength(1);
  });

  it('shows the estimate badge and note when not verified', () => {
    render(<ScoreDiffBreakdown {...baseProps} />);
    expect(screen.getByText('sections.optimize.scoreDiff.estimateBadge')).toBeInTheDocument();
    expect(screen.getByText('sections.optimize.scoreDiff.estimateNote')).toBeInTheDocument();
    expect(screen.queryByText('sections.optimize.scoreDiff.verifiedBadge')).not.toBeInTheDocument();
  });

  it('shows the verified badge and all-applied caveat when verified', () => {
    render(<ScoreDiffBreakdown {...baseProps} isScoreVerified afterScore={78} />);
    expect(screen.getByText('sections.optimize.scoreDiff.verifiedBadge')).toBeInTheDocument();
    expect(screen.getByText('sections.optimize.scoreDiff.verifiedNote')).toBeInTheDocument();
  });

  it('shows the equal-share legend as improvement/total to one decimal', () => {
    render(<ScoreDiffBreakdown {...baseProps} />);
    // 20 / 3 = 6.7
    expect(
      screen.getByText((c) => c.includes('perCardShare') && c.includes('points=6.7'))
    ).toBeInTheDocument();
  });

  it('shows the noneApplied message and no fabricated gain when zero applied', () => {
    render(
      <ScoreDiffBreakdown
        {...baseProps}
        afterScore={60}
        optimizations={[opt('a', false), opt('b', false)]}
      />
    );
    expect(screen.getByText('sections.optimize.scoreDiff.noneApplied')).toBeInTheDocument();
  });

  it('renders an em-dash for placeholder score without fabricating a number', () => {
    render(
      <ScoreDiffBreakdown
        {...baseProps}
        isPlaceholderScore
        isPlaceholderImprovement
      />
    );
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    // no equal-share legend when improvement is a placeholder
    expect(
      screen.queryByText((c) => c.includes('perCardShare'))
    ).not.toBeInTheDocument();
  });

  it('fires a metadata-only analytics event when the breakdown is expanded', () => {
    render(<ScoreDiffBreakdown {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /showCards|hideCards/i }));
    expect(trackScoreDiffExpanded).toHaveBeenCalledTimes(1);
    const payload = trackScoreDiffExpanded.mock.calls[0][0];
    expect(payload).toMatchObject({ appliedCount: 2, totalCount: 3, isVerified: false });
    expect(JSON.stringify(payload)).not.toContain('Worked on things');
  });
});
