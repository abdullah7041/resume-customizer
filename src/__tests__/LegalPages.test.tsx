import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PrivacyPolicy } from '@/pages/PrivacyPolicy';
import { TermsOfService } from '@/pages/TermsOfService';
import enTerms from '@/locales/en/terms.json';
import arTerms from '@/locales/ar/terms.json';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en' },
  }),
}));

describe('legal pages', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses a reviewed fixed date on privacy and terms pages', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-15T12:00:00Z'));

    const { unmount } = render(<PrivacyPolicy />);
    expect(screen.getByText(/privacy.lastUpdated:/)).toHaveTextContent('August 15, 2026');
    unmount();

    render(<TermsOfService />);
    expect(screen.getByText(/terms.lastUpdated:/)).toHaveTextContent('August 15, 2026');
  });

  it('ships complete English and Arabic Terms resources', () => {
    expect(enTerms.terms.title).toBe('Terms of Service');
    expect(arTerms.terms.title).toBe('شروط الخدمة');
    expect(arTerms.terms.sections.intro.content).toMatch(/[\u0600-\u06FF]/);
    expect(arTerms.terms.sections.beta.content).toMatch(/تجريبية/);
  });
});
