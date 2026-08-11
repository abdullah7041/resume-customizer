import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPromptShown = vi.hoisted(() => vi.fn());
const mockAnswered = vi.hoisted(() => vi.fn());

vi.mock('@/services/analytics', () => ({
  analytics: {
    trackGuestValidationPromptShown: mockPromptShown,
    trackGuestValidationAnswered: mockAnswered,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

import { GuestValidationPrompt } from '@/components/Feedback/GuestValidationPrompt';

describe('GuestValidationPrompt', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('asks once per locally hashed vacancy and records a one-click trust answer', async () => {
    const onClose = vi.fn();
    render(<GuestValidationPrompt jobDescription="Backend engineer role" attempt={2} onClose={onClose} />);

    expect(await screen.findByRole('complementary', { name: 'Guest validation question' })).toBeInTheDocument();
    expect(mockPromptShown).toHaveBeenCalledWith({ attempt: 2 });

    fireEvent.click(screen.getByRole('button', { name: 'Somewhat' }));
    expect(mockAnswered).toHaveBeenCalledWith({ attempt: 2, trust: 'somewhat' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
