import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackModal } from '../components/Feedback/FeedbackModal';

const submitFeedbackReportMock = vi.hoisted(() => vi.fn());
const trackFeedbackSubmittedMock = vi.hoisted(() => vi.fn());

vi.mock('../services/feedback', () => ({
  submitFeedbackReport: submitFeedbackReportMock,
  buildFeedbackContext: () => ({
    pagePath: '/templates',
    userAgent: 'Vitest Browser',
    viewport: 'desktop 1024x768 pointer',
    contextFeature: 'templates',
  }),
}));

vi.mock('../services/analytics', () => ({
  analytics: {
    trackFeedbackSubmitted: trackFeedbackSubmittedMock,
  },
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
        'feedback.fields.message': 'What felt wrong, generic, or confusing?',
        'feedback.fields.messagePlaceholder': 'Tell us what felt off and what you expected instead.',
        'feedback.fields.minimumMet': 'Looks detailed enough.',
        'feedback.fields.rating': 'Rating (optional)',
        'feedback.fields.noRating': 'No rating',
        'feedback.fields.noAnswer': 'No answer',
        'feedback.fields.trustToApply': 'Would you trust this resume enough to apply?',
        'feedback.fields.willingnessToPay': 'Would you pay for this if it saved you time?',
        'feedback.trustToApply.yes': 'Yes',
        'feedback.trustToApply.somewhat': 'Somewhat',
        'feedback.trustToApply.no': 'No',
        'feedback.willingnessToPay.yes': 'Yes',
        'feedback.willingnessToPay.maybe': 'Maybe',
        'feedback.willingnessToPay.no': 'No',
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

    fireEvent.change(screen.getByLabelText(/what felt wrong/i), {
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

    expect(screen.getByLabelText(/would you trust/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/would you pay/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/what felt wrong/i), {
      target: {
        value: 'The resume export failed after retrying from the templates step.',
      },
    });
    fireEvent.change(screen.getByLabelText(/rating/i), {
      target: { value: '4' },
    });
    fireEvent.change(screen.getByLabelText(/would you trust/i), {
      target: { value: 'somewhat' },
    });
    fireEvent.change(screen.getByLabelText(/would you pay/i), {
      target: { value: 'maybe' },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }));

    await waitFor(() => {
      expect(submitFeedbackReportMock).toHaveBeenCalledWith({
        type: 'bug',
        message: 'The resume export failed after retrying from the templates step.',
        rating: 4,
        validation: {
          trustToApply: 'somewhat',
          willingnessToPay: 'maybe',
        },
      });
    });
    expect(trackFeedbackSubmittedMock).toHaveBeenCalledWith({
      feedbackType: 'bug',
      rating: 4,
      hasMessage: true,
      trustToApply: 'somewhat',
      willingnessToPay: 'maybe',
      contextFeature: 'templates',
    });
    expect(await screen.findByRole('status')).toHaveTextContent(/submitted/i);
    expect(refreshListener).toHaveBeenCalledTimes(1);

    window.removeEventListener('refreshCredits', refreshListener);
  });
});
