import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import LandingPage from '../pages/LandingPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {
      language: 'en',
      dir: () => 'ltr',
    },
    t: (key: string, options?: { returnObjects?: boolean }) => {
      if (options?.returnObjects) {
        if (key === 'landing.majlis.changedList') {
          return [
            { text: 'Specific job-ad keywords surfaced.' },
            { text: 'No fake metrics were added.' },
          ];
        }
        if (key === 'landing.productWalkthrough.actionDemo.changes') {
          return [
            'Specific job-ad keywords surfaced.',
            'No fake metrics were added.',
          ];
        }
        return [];
      }
      const translations: Record<string, string> = {
        'landing.comparison.title': 'Compare proof, not just templates.',
        'landing.comparison.eyebrow': 'Workflow comparison',
        'landing.comparison.subtitle': 'See how Watheq protects evidence and scores fit.',
        'landing.comparison.watheq': 'Watheq',
        'landing.comparison.genericResumeBuilder': 'Generic Resume Builder',
        'landing.comparison.keywordScanner': 'Keyword Scanner',
        'landing.comparison.manualEditing': 'Manual Editing',
        'landing.comparison.features.vision2030': 'Vision 2030 Alignment',
        'landing.comparison.features.antiHallucination': 'Evidence Protection',
        'landing.comparison.features.clarification': 'Ask-before-rewrite clarification',
        'landing.comparison.features.fitScoring': 'Evidence-based fit scoring before rewriting',
        'landing.comparison.features.jobMatch': 'AI Job Match',
        'landing.comparison.features.atsPassRate': 'ATS and Job-Ad Alignment',
        'landing.comparison.features.interviewPrep': 'Interview Preparation',
        'landing.comparison.values.yes': 'Yes',
        'landing.comparison.values.no': 'No',
        'landing.comparison.values.partial': 'Partial',
        'landing.comparison.values.watheqAts': 'Evidence-aware alignment',
        'landing.comparison.values.resumeBuilderAts': 'Template-focused',
        'landing.comparison.values.keywordScannerAts': 'Keyword signals only',
        'landing.comparison.values.manualEditingAts': 'Depends on review',
        'landing.comparison.values.watheqClarification': 'Asks when proof is missing',
        'landing.comparison.values.resumeBuilderClarification': 'No structured questions',
        'landing.comparison.values.keywordScannerClarification': 'Flags keywords only',
        'landing.comparison.values.manualEditingClarification': 'Depends on reviewer',
        'landing.comparison.values.watheqFitScoring': 'Scores evidence before rewriting',
        'landing.comparison.values.resumeBuilderFitScoring': 'Template-first guidance',
        'landing.comparison.values.keywordScannerFitScoring': 'Keyword count focus',
        'landing.comparison.values.manualEditingFitScoring': 'Manual judgment',
        'landing.productWalkthrough.finalEyebrow': 'Ready',
        'landing.productWalkthrough.finalTitle': 'Start with your next application',
        'landing.productWalkthrough.cta': 'Get Started',
        'landing.productWalkthrough.actionDemo.eyebrow': 'See it in action',
        'landing.productWalkthrough.actionDemo.heroLink': 'See it in action',
        'landing.productWalkthrough.actionDemo.title': 'Watch a weak bullet become proof-led.',
        'landing.productWalkthrough.actionDemo.subtitle': 'See Watheq preserve truth while improving the application.',
        'landing.productWalkthrough.actionDemo.sampleLabel': 'Sample resume context',
        'landing.productWalkthrough.actionDemo.sampleTitle': 'Senior Business Analyst application',
        'landing.productWalkthrough.actionDemo.weakLabel': 'Before',
        'landing.productWalkthrough.actionDemo.optimizedLabel': 'Optimized',
        'landing.productWalkthrough.actionDemo.showOptimized': 'Show optimized',
        'landing.productWalkthrough.actionDemo.showWeak': 'Show before',
        'landing.productWalkthrough.actionDemo.weakBullet': 'Prepared weekly reports and dashboards for management.',
        'landing.productWalkthrough.actionDemo.optimizedBullet': 'Built weekly Power BI dashboards for leadership follow-ups.',
        'landing.productWalkthrough.actionDemo.jobContextLabel': 'Target job signal',
        'landing.productWalkthrough.actionDemo.jobContext': 'The role asks for KPI reporting and Power BI.',
        'landing.productWalkthrough.actionDemo.questionLabel': 'Watheq asks before adding numbers',
        'landing.productWalkthrough.actionDemo.question': 'Can you verify the dashboard scope?',
        'landing.productWalkthrough.actionDemo.changedTitle': 'What changed',
        'landing.productWalkthrough.actionDemo.verifyNote': 'Sample only.',
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

vi.mock('../components/sections/PricingSection', () => ({
  PricingSection: () => <section id="pricing">Public pricing plans</section>,
}));

vi.mock('../components/Credits/PricingWaitlistModal', () => ({
  PricingWaitlistModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog">Pricing waitlist modal</div> : null,
}));

describe('Landing pricing and comparison placement', () => {
  it('keeps full pricing and comparison available on the public landing page', () => {
    render(<LandingPage onGetStarted={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Compare proof, not just templates.' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Generic builder' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Keyword scanner' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Manual editing' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Start free. Everything you need to apply.' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Free' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pro' })).toBeInTheDocument();
    expect(screen.getByText('0 SAR')).toBeInTheDocument();
    expect(screen.getByText('29 SAR')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Join the pricing waitlist' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Pricing waitlist modal');
    expect(screen.queryByText('Native Arabic Support')).not.toBeInTheDocument();
    expect(screen.queryByText('Professional Templates')).not.toBeInTheDocument();
    expect(screen.queryByText(RegExp(['Generic', 'Tool', 'A'].join(' '), 'i'))).not.toBeInTheDocument();
  });

  it('lets visitors compare a weak sample with an optimized proof-led version', () => {
    render(<LandingPage onGetStarted={vi.fn()} />);

    expect(screen.getByRole('link', { name: 'The proof' })).toHaveAttribute('href', '#mj2-demo');
    expect(screen.getByRole('heading', { name: 'One weak line, rewritten honestly.' })).toBeInTheDocument();
    expect(screen.getByText('Prepared weekly reports and dashboards for management.')).toBeInTheDocument();

    const optimizedButton = screen.getByRole('button', { name: 'Optimized' });
    fireEvent.click(optimizedButton);

    expect(optimizedButton).toHaveClass('is-active');
    expect(screen.getByText('Built weekly Power BI dashboards that helped leadership track KPI trends and prioritize stakeholder follow-ups across business units.')).toBeInTheDocument();
    expect(screen.getByText('Specific job-ad keywords surfaced.')).toBeInTheDocument();
  });
});
