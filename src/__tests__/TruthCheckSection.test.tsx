import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TruthCheckSection } from '../components/sections/TruthCheckSection';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe('TruthCheckSection guest messaging', () => {
  const baseProps = {
    resumeText: 'Sara Al-Otaibi product manager resume',
    result: null,
    isAnalyzing: false,
    onAnalyze: vi.fn(),
  };

  it('shows the sign-in availability message only for guests', () => {
    const { rerender } = render(<TruthCheckSection {...baseProps} isGuestMode />);

    expect(screen.getByText('Truth Check is only available after you sign in.')).toBeInTheDocument();

    rerender(<TruthCheckSection {...baseProps} isGuestMode={false} />);

    expect(screen.queryByText('Truth Check is only available after you sign in.')).toBeNull();
  });
});
