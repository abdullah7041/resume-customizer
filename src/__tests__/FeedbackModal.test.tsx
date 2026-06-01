import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackModal } from '../components/Feedback/FeedbackModal';

const submitFeedbackReportMock = vi.hoisted(() => vi.fn());

vi.mock('../services/feedback', () => ({
  submitFeedbackReport: submitFeedbackReportMock,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, optionsOrFallback?: string | Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'feedback.title': 'Send feedback',
        'feedback.subtitle': 'Report a bug, confusing step, or product idea.',
        'feedback.reward.copy': 'Eligible first feedback earns +5 credits.',
        'feedback.reward.awarded': '+5 credits added to your balance.',
        'feedback.fields.type': 'Type',
        'feedback.fields.message': 'Message',
        'feedback.fields.messagePlaceholder': 'Tell us what happened and what you expected instead.',
        'feedback.fields.minimumMet': 'Looks detailed enough.',
        'feedback.fields.rating': 'Rating (optional)',
        'feedback.fields.noRating': 'No rating',
        'feedback.submit': 'Submit feedback',
        'feedback.submitting': 'Submitting...',
        'feedback.success': 'Thanks. Your feedback was submitted.',
        'feedback.types.bug': 'Bug',
        'feedback.types.resume_quality': 'Resume quality',
        'feedback.types.confusing_ux': 'Confusing UX',
        'feedback.types.feature_request': 'Feature request',
        'feedback.types.pricing_credits': 'Pricing or credits',
        'feedback.types.other': 'Other',
        'common.cancel': 'Cancel',
        'common.closeDialog': 'Close dialog',
      };
      if (key === 'feedback.errors.messageTooShort') {
        const count = typeof optionsOrFallback === 'object' ? optionsOrFallback.count : 0;
        return `Add ${count} more characters so the report is useful.`;
      }
      return translations[key] ?? (typeof optionsOrFallback === 'string' ? optionsOrFallback : key);
    },
    i18n: { dir: () => 'ltr' },
  }),
}));

describe('FeedbackModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates minimum meaningful feedback before submitting', () => {
    render(<FeedbackModal isOpen onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: 'Too short' },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/add 21 more characters/i);
    expect(submitFeedbackReportMock).not.toHaveBeenCalled();
  });

  it('submits feedback and refreshes credits when the backend awards the reward', async () => {
    const refreshListener = vi.fn();
    window.addEventListener('refreshCredits', refreshListener);
    submitFeedbackReportMock.mockResolvedValue({
      success: true,
      id: 'feedback-1',
      rewardStatus: 'awarded',
      creditsAwarded: 5,
      creditsRemaining: 25,
    });

    render(<FeedbackModal isOpen onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/message/i), {
      target: {
        value: 'The resume export failed after retrying from the templates step.',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }));

    await waitFor(() => {
      expect(submitFeedbackReportMock).toHaveBeenCalledWith({
        type: 'bug',
        message: 'The resume export failed after retrying from the templates step.',
        rating: null,
      });
    });
    expect(await screen.findByRole('status')).toHaveTextContent(/submitted/i);
    expect(refreshListener).toHaveBeenCalledTimes(1);

    window.removeEventListener('refreshCredits', refreshListener);
  });
});
