/**
 * Bug: exported resume PDF was missing the professional summary.
 *
 * The summary was dropped at PARSE time (basics.summary not extracted), not at
 * render time. Every template renders basics.summary, but only when it exists
 * (gated `basics.summary &&`). This test pins that contract: summary present in
 * the data -> visible in the rendered template; summary absent -> nothing shown
 * (no crash, no placeholder). If a template silently stops rendering summary,
 * this fails.
 */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock('../hooks/useSectionLabel', () => ({
  useSectionLabel: () => (key: string) => {
    const labels: Record<string, string> = {
      about: 'About', experience: 'Experience', education: 'Education',
      skills: 'Skills', projects: 'Projects', certifications: 'Certifications',
      languages: 'Languages',
    };
    return labels[key] || key;
  },
}));

vi.mock('../components/providers/DirectionProvider', () => ({
  useDirection: () => ({ isRTL: false, direction: 'ltr' }),
  DirectionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../lib/stores/resumeStore', () => ({
  useResumeStore: (selector: (s: Record<string, unknown>) => unknown) => {
    const mockState = {
      displayOptions: {
        baseFontSize: 10.5, headingSize: 14, fontFamily: "'Inter', sans-serif",
        sectionSpacing: 12, paragraphSpacing: 6, lineHeight: 1.5,
        marginTop: 0.6, marginBottom: 0.5, marginSide: 0.7,
        fontSize: 1, showPageBreaks: false, boldKeywords: true,
      },
    };
    return selector(mockState);
  },
}));

const SUMMARY = 'Data-driven Senior Business Intelligence Analyst with 5+ years of experience.';

const makeResume = (summary: string) => ({
  basics: {
    name: 'Abdullah Bin Ahmed', label: 'Senior BI Analyst & Data Architect',
    email: 'a@example.com', phone: '+966 555 0000', summary,
    location: { city: 'Dammam', region: 'Eastern Province', countryCode: 'SA' },
    profiles: [{ network: 'LinkedIn', url: 'https://linkedin.com/in/3binahmed', username: '3binahmed' }],
  },
  work: [{
    name: 'Al Ghalia', position: 'Senior Data Analyst', location: 'Dammam',
    startDate: '2020-03', endDate: 'Present', summary: '',
    highlights: ['Delivered 15+ Power BI dashboards'],
  }],
  education: [{ institution: 'SPSP', studyType: 'Diploma', area: 'Pipefitting', startDate: '2016', endDate: '2018' }],
  skills: [{ name: 'BI', keywords: ['Power BI', 'SQL'] }],
  projects: [],
  certificates: [],
  languages: [{ language: 'Arabic', fluency: 'Native' }],
});

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => { cleanup(); });

describe('Bug: every template renders basics.summary when present', () => {
  it('all registered templates show the summary text', async () => {
    const { TEMPLATES } = await import('../components/templates/registry');
    const ids = Object.keys(TEMPLATES);
    expect(ids.length).toBeGreaterThan(0);

    for (const id of ids) {
      const Template = TEMPLATES[id as keyof typeof TEMPLATES];
      const { container } = render(<Template resume={makeResume(SUMMARY) as never} />);
      expect(container.innerHTML, `template "${id}" dropped the summary`).toContain(SUMMARY);
      cleanup();
    }
  });

  it('renders no summary text when basics.summary is empty (gating works)', async () => {
    const { TEMPLATES } = await import('../components/templates/registry');
    for (const id of Object.keys(TEMPLATES)) {
      const Template = TEMPLATES[id as keyof typeof TEMPLATES];
      const { container } = render(<Template resume={makeResume('') as never} />);
      expect(container.innerHTML, `template "${id}" showed stale summary`).not.toContain(SUMMARY);
      cleanup();
    }
  });
});
