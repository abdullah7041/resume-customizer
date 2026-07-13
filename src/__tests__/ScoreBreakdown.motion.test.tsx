import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ScoreBreakdown, type CategoryScoresData } from '@/components/ScoreBreakdown';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

const categoryScores: CategoryScoresData = {
  hard_skills: { score: 20, max: 25 },
  experience: { score: 20, max: 25 },
  education: { score: 20, max: 25 },
  soft_skills: { score: 20, max: 25 },
};

describe('ScoreBreakdown motion accessibility', () => {
  it('disables the CSS shimmer when reduced motion is requested', () => {
    const { container } = render(
      <ScoreBreakdown
        categoryScores={categoryScores}
        beforeScore={80}
        afterScore={80}
      />,
    );

    const shimmers = container.querySelectorAll('.animate-shimmer');
    expect(shimmers).toHaveLength(4);
    shimmers.forEach((shimmer) => {
      expect(shimmer).toHaveClass('motion-reduce:animate-none');
    });
  });
});
