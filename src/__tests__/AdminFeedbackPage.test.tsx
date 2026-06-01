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
});
