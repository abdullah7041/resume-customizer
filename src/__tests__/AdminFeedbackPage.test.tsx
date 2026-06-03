import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminFeedbackPage } from '../pages/AdminFeedbackPage';

const authState = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; app_metadata: Record<string, unknown>; user_metadata: Record<string, unknown> },
  loading: false,
}));

const listFeedbackReportsMock = vi.hoisted(() => vi.fn());

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('../services/feedback', () => ({
  listFeedbackReports: listFeedbackReportsMock,
  updateFeedbackReport: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => {
      const translations: Record<string, string> = {
        'feedback.admin.accessDeniedTitle': 'Admin access required',
        'feedback.admin.accessDeniedBody': 'This dashboard is only available to Watheq admins.',
        'feedback.admin.eyebrow': 'Admin',
        'feedback.admin.title': 'Feedback reports',
        'feedback.admin.count': `${options?.count ?? 0} reports`,
        'feedback.admin.listTitle': 'Incoming feedback',
        'feedback.admin.empty': 'No feedback reports yet.',
        'feedback.admin.selectPrompt': 'Select a report to review.',
        'feedback.admin.fields.trustToApply': 'Trust to apply',
        'feedback.admin.fields.willingnessToPay': 'Willingness to pay',
        'feedback.trustToApply.somewhat': 'Somewhat',
        'feedback.willingnessToPay.maybe': 'Maybe',
      };
      return translations[key] ?? key;
    },
    i18n: { language: 'en', dir: () => 'ltr' },
  }),
}));

describe('AdminFeedbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.loading = false;
    authState.user = null;
    listFeedbackReportsMock.mockResolvedValue([]);
  });

  it('blocks non-admin users in the UI', () => {
    authState.user = {
      id: 'user-1',
      email: 'user@example.com',
      app_metadata: {},
      user_metadata: {},
    };

    render(<AdminFeedbackPage />);

    expect(screen.getByText('Admin access required')).toBeInTheDocument();
    expect(listFeedbackReportsMock).not.toHaveBeenCalled();
  });

  it('loads the admin list for app_metadata role admins', async () => {
    authState.user = {
      id: 'admin-1',
      email: 'admin@example.com',
      app_metadata: { role: 'admin' },
      user_metadata: {},
    };

    render(<AdminFeedbackPage />);

    expect(await screen.findByText('Feedback reports')).toBeInTheDocument();
    expect(listFeedbackReportsMock).toHaveBeenCalled();
  });

  it('renders structured validation answers in the admin detail panel', async () => {
    authState.user = {
      id: 'admin-1',
      email: 'admin@example.com',
      app_metadata: { role: 'admin' },
      user_metadata: {},
    };
    listFeedbackReportsMock.mockResolvedValue([
      {
        id: 'feedback-1',
        user_id: 'user-1',
        user_email: 'user@example.com',
        type: 'resume_quality',
        message: 'The improved summary became too generic for my original resume context.',
        rating: 3,
        trust_to_apply: 'somewhat',
        willingness_to_pay: 'maybe',
        page_path: '/workspace',
        status: 'new',
        priority: 'normal',
        reward_status: 'awarded',
        credits_awarded: 5,
        admin_notes: null,
        created_at: '2026-06-03T10:00:00.000Z',
        updated_at: '2026-06-03T10:00:00.000Z',
      },
    ]);

    render(<AdminFeedbackPage />);

    expect(await screen.findByText('Trust to apply')).toBeInTheDocument();
    expect(screen.getByText('Willingness to pay')).toBeInTheDocument();
    expect(screen.getByText('Somewhat')).toBeInTheDocument();
    expect(screen.getByText('Maybe')).toBeInTheDocument();
  });
});
