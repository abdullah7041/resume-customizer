import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import LandingPage from '../pages/LandingPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { returnObjects?: boolean }) => {
      if (options?.returnObjects) return [];
      const translations: Record<string, string> = {
        'landing.comparison.title': 'Why Choose Watheq?',
        'landing.comparison.subtitle': 'See how Watheq compares',
        'landing.comparison.watheq': 'Watheq',
        'landing.comparison.genericResumeBuilder': 'Generic Resume Builder',
        'landing.comparison.keywordScanner': 'Keyword Scanner',
        'landing.comparison.manualEditing': 'Manual Editing',
        'landing.comparison.features.vision2030': 'Vision 2030 Alignment',
        'landing.comparison.features.antiHallucination': 'Evidence Protection',
        'landing.comparison.features.arabicSupport': 'Native Arabic Support',
        'landing.comparison.features.jobMatch': 'AI Job Match',
        'landing.comparison.features.atsPassRate': 'ATS and Job-Ad Alignment',
        'landing.comparison.features.templates': 'Professional Templates',
        'landing.comparison.features.interviewPrep': 'Interview Preparation',
        'landing.comparison.values.yes': 'Yes',
        'landing.comparison.values.no': 'No',
        'landing.comparison.values.partial': 'Partial',
        'landing.comparison.values.watheqAts': 'Evidence-aware alignment',
        'landing.comparison.values.resumeBuilderAts': 'Template-focused',
        'landing.comparison.values.keywordScannerAts': 'Keyword signals only',
        'landing.comparison.values.manualEditingAts': 'Depends on review',
        'landing.comparison.values.watheqTemplates': 'ATS-friendly formats',
        'landing.comparison.values.resumeBuilderTemplates': 'Template library',
        'landing.comparison.values.keywordScannerTemplates': 'Limited formatting help',
        'landing.comparison.values.manualEditingTemplates': 'Self-managed formatting',
        'landing.productWalkthrough.finalEyebrow': 'Ready',
        'landing.productWalkthrough.finalTitle': 'Start with your next application',
        'landing.productWalkthrough.cta': 'Get Started',
      };
      return translations[key] ?? key;
    },
  }),
}));

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
          React.createElement(tag, props, children),
    }
  ),
  useReducedMotion: () => true,
}));

vi.mock('../lib/assets', () => ({
  getSkylineUrls: () => ({
    desktop: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
    mobile: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
  }),
}));

vi.mock('../components/sections/ProductWalkthrough', () => ({
  ProductWalkthrough: () => <section>Product walkthrough</section>,
}));

vi.mock('../components/sections/PricingSection', () => ({
  PricingSection: () => <section id="pricing">Public pricing plans</section>,
}));

describe('Landing pricing and comparison placement', () => {
  it('keeps full pricing and comparison available on the public landing page', () => {
    render(<LandingPage onGetStarted={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Why Choose Watheq?' })).toBeInTheDocument();
    expect(screen.getByText('Generic Resume Builder')).toBeInTheDocument();
    expect(screen.getByText('Keyword Scanner')).toBeInTheDocument();
    expect(screen.getByText('Manual Editing')).toBeInTheDocument();
    expect(screen.queryByText(RegExp(['Generic', 'Tool', 'A'].join(' '), 'i'))).not.toBeInTheDocument();
    expect(screen.getByText('Public pricing plans')).toBeInTheDocument();
  });
});
