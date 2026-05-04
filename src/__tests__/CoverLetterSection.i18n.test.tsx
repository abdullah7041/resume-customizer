import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoverLetterSection } from '../components/sections/CoverLetterSection';

let language = 'ar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: {
      get language() {
        return language;
      },
    },
  }),
}));

vi.mock('../hooks/useUserCredits', () => ({
  useUserCredits: () => ({
    credits: { remaining: 10 },
    refetch: vi.fn(),
  }),
}));

vi.mock('../hooks/useFeatureTracking', () => ({
  useFeatureTracking: () => ({
    trackFeatureUse: vi.fn(),
    shouldShowFeedback: false,
    dismissFeedback: vi.fn(),
  }),
}));

vi.mock('../lib/stores/resumeStore', () => ({
  useResumeStore: {
    getState: () => ({
      optimizationMetrics: { jdKeywords: [] },
      displayOptions: { boldKeywords: true },
    }),
  },
}));

vi.mock('../services/analytics', () => ({
  analytics: {
    trackCoverLetter: vi.fn(),
  },
}));

vi.mock('../components/Credits/UpgradeModal', () => ({
  UpgradeModal: () => null,
}));

vi.mock('../components/Credits/ConfirmActionModal', () => ({
  ConfirmActionModal: () => null,
}));

vi.mock('../components/Feedback/FeedbackModal', () => ({
  FeedbackModal: () => null,
}));

const renderCoverLetter = () => render(
  <CoverLetterSection
    resumeText="Resume text"
    jobDescription="Job description"
    resumeData={{
      basics: {
        name: 'سارة الأحمد',
        label: 'مديرة مشاريع',
        email: 'sara@example.com',
        phone: '+966500000000',
        summary: 'ملخص مهني',
        location: { city: 'Riyadh', region: 'Riyadh', countryCode: 'SA' },
        profiles: [],
      },
      work: [],
      education: [],
      skills: [],
    }}
  />
);

describe('CoverLetterSection Arabic and English behavior', () => {
  beforeEach(() => {
    localStorage.clear();
    language = 'ar';
    localStorage.setItem('airo:coverLetter', JSON.stringify({
      coverLetter: 'أمتلك خبرة قوية في قيادة المبادرات الرقمية.\n\nوأستطيع دعم أهداف الفريق.',
      companyName: 'شركة واثق',
      hiringManager: '',
      tone: 'professional',
      keyHighlights: ['قيادة المبادرات الرقمية'],
      signatureName: 'سارة الأحمد',
    }));
  });

  it('renders Arabic tone labels and rtl cover letter document chrome', () => {
    renderCoverLetter();

    expect(screen.getByRole('button', { name: /احترافي/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /متحمس/i })).toBeInTheDocument();

    const document = screen.getByText('شركة واثق').closest('[dir="rtl"]');
    expect(document).toBeInTheDocument();
    expect(screen.getByText('السادة فريق التوظيف،')).toBeInTheDocument();
    expect(screen.getByText('مع خالص التحية،')).toBeInTheDocument();
  });

  it('keeps English tone labels and ltr cover letter document chrome', () => {
    language = 'en';
    localStorage.setItem('airo:coverLetter', JSON.stringify({
      coverLetter: 'I can support the team with practical delivery experience.',
      companyName: 'Watheq',
      hiringManager: '',
      tone: 'professional',
      keyHighlights: [],
      signatureName: 'Sara Alahmad',
    }));

    renderCoverLetter();

    expect(screen.getByRole('button', { name: /professional/i })).toBeInTheDocument();
    expect(screen.getByText('Watheq').closest('[dir="ltr"]')).toBeInTheDocument();
    expect(screen.getByText('Dear Hiring Manager,')).toBeInTheDocument();
    expect(screen.getByText('Sincerely,')).toBeInTheDocument();
  });
});
