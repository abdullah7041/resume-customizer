import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TruthCheckSection } from '../components/sections/TruthCheckSection';
import type { ResumeTruthCheckResult } from '../types/truth-check';

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

describe('TruthCheckSection re-run behavior', () => {
  const baseResult: ResumeTruthCheckResult = {
    overallRisk: 'low',
    claims: [],
    limits: { cannotVerify: [] },
  } as unknown as ResumeTruthCheckResult;

  it('shows "Run Truth Check" and calls onAnalyze with force:true when there is no result yet', async () => {
    const onAnalyze = vi.fn();
    const user = userEvent.setup();
    render(
      <TruthCheckSection
        resumeText="Sara Al-Otaibi product manager resume"
        result={null}
        isAnalyzing={false}
        onAnalyze={onAnalyze}
      />
    );

    const button = screen.getByRole('button', { name: /Run Truth Check/i });
    expect(button).toBeInTheDocument();

    await user.click(button);
    expect(onAnalyze).toHaveBeenCalledWith({ force: true });
  });

  it('shows "Re-run Truth Check" and still calls onAnalyze with force:true once a result exists', async () => {
    const onAnalyze = vi.fn();
    const user = userEvent.setup();
    render(
      <TruthCheckSection
        resumeText="Sara Al-Otaibi product manager resume"
        result={baseResult}
        isAnalyzing={false}
        onAnalyze={onAnalyze}
      />
    );

    const button = screen.getByRole('button', { name: /Re-run Truth Check/i });
    expect(button).toBeInTheDocument();

    await user.click(button);
    expect(onAnalyze).toHaveBeenCalledWith({ force: true });
  });
});
