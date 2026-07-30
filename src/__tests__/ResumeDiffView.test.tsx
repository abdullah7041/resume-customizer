import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ResumeDiffView from '../components/sections/ResumeDiffView';
import type { OptimizationResult } from '../types/templates';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { count: number }) =>
      typeof fallback === 'string' ? fallback : key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('../components/ui/GlassButton', () => ({
  GlassButton: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
}));

const improvedOptimization = {
  sectionId: 'summary-1',
  sectionType: 'summary',
  original: 'Built web applications.',
  optimized: 'Built React applications for enterprise customers.',
  applied: true,
} as OptimizationResult;

describe('ResumeDiffView', () => {
  it('uses the emerald improvement treatment in both desktop and mobile diffs', () => {
    render(<ResumeDiffView isOpen onClose={vi.fn()} optimizations={[improvedOptimization]} />);

    const improvedBadges = screen.getAllByText('Improved').map((badge) => badge.closest('span'));
    expect(improvedBadges).toHaveLength(2);
    improvedBadges.forEach((badge) => {
      expect(badge).toHaveClass('bg-emerald-500/20', 'text-emerald-400');
      expect(badge).not.toHaveClass('bg-blue-500/20', 'text-blue-400');
    });
  });
});
