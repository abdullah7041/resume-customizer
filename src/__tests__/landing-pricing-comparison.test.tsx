import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import LandingPage from '../pages/LandingPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { returnObjects?: boolean }) => {
      if (options?.returnObjects) {
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

describe('Landing pricing and comparison placement', () => {
  it('keeps full pricing and comparison available on the public landing page', () => {
    render(<LandingPage onGetStarted={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Compare proof, not just templates.' })).toBeInTheDocument();
    expect(screen.getAllByText('Generic Resume Builder').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Keyword Scanner').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Manual Editing').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ask-before-rewrite clarification').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Evidence-based fit scoring before rewriting').length).toBeGreaterThan(0);
    expect(screen.queryByText('Native Arabic Support')).not.toBeInTheDocument();
    expect(screen.queryByText('Professional Templates')).not.toBeInTheDocument();
    expect(screen.queryByText(RegExp(['Generic', 'Tool', 'A'].join(' '), 'i'))).not.toBeInTheDocument();
    expect(screen.getByText('Public pricing plans')).toBeInTheDocument();
  });

  it('lets visitors compare a weak sample with an optimized proof-led version', () => {
    render(<LandingPage onGetStarted={vi.fn()} />);

    expect(screen.getByRole('link', { name: /see it in action/i })).toHaveAttribute('href', '#see-it-in-action');
    expect(screen.getByRole('heading', { name: 'Watch a weak bullet become proof-led.' })).toBeInTheDocument();
    expect(screen.getByText('Prepared weekly reports and dashboards for management.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show optimized/i }));

    const toggleButton = screen.getByRole('button', { name: /show before/i });
    expect(toggleButton).toHaveAttribute('aria-pressed', 'true');
    expect(toggleButton).toHaveAttribute('aria-controls');
    expect(screen.getByText('Built weekly Power BI dashboards for leadership follow-ups.')).toBeInTheDocument();
    expect(screen.getByText('Specific job-ad keywords surfaced.')).toBeInTheDocument();
  });
});
