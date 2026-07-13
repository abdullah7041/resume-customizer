import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AtsExplainabilityPanel } from '../components/AtsExplainabilityPanel';
import type { AtsExplainabilitySource } from '../types/explainability';
import type { StrategicRealityCheck } from '../types/analysis';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && typeof opts.count === 'number' ? `${key}:${opts.count}` : key,
    i18n: { language: 'en' },
  }),
}));

const trackExplainabilityPanelOpened = vi.fn();
vi.mock('../services/analytics', () => ({
  analytics: {
    trackExplainabilityPanelOpened: (...args: unknown[]) =>
      trackExplainabilityPanelOpened(...args),
  },
}));

afterEach(() => {
  cleanup();
  trackExplainabilityPanelOpened.mockClear();
});

const realityCheck: StrategicRealityCheck = {
  riskTier: 'medium',
  recommendation: 'optimize_now',
  confidence: 'medium',
  riskTypes: [],
  summary: '',
  strengths: [
    {
      title: 'Led a data team',
      whyItMatters: 'Matches leadership requirement.',
      evidence: [{ source: 'resume', snippet: 'Managed a team of 6 analysts' }],
    },
  ],
  confirmedRisks: [
    {
      type: 'short_tenure',
      severity: 'high',
      title: 'Short tenure',
      explanation: 'Only 8 months.',
      mitigation: 'Explain contract nature.',
    },
  ],
  unclearRisks: [
    { type: 'skill', topic: 'K8s depth', reason: 'no detail', evidenceNeeded: 'a project' },
  ],
  limits: { cannotDetermine: ['Salary'], assumptions: ['English fluency'] },
};

const fullSource: AtsExplainabilitySource = {
  matchedKeywords: ['React'],
  missingKeywords: ['GraphQL'],
  realityCheck,
};

describe('AtsExplainabilityPanel', () => {
  it('renders the four bucket titles once expanded', () => {
    render(<AtsExplainabilityPanel source={fullSource} context="match" />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByText('sections.explainability.buckets.matched.title')).toBeInTheDocument();
    expect(screen.getByText('sections.explainability.buckets.missing.title')).toBeInTheDocument();
    expect(screen.getByText('sections.explainability.buckets.weak.title')).toBeInTheDocument();
    expect(screen.getByText('sections.explainability.buckets.caution.title')).toBeInTheDocument();
  });

  it('renders an evidence snippet verbatim with a source badge', () => {
    render(<AtsExplainabilityPanel source={fullSource} context="match" />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByText('“Managed a team of 6 analysts”')).toBeInTheDocument();
    expect(screen.getByText('sections.explainability.sourceBadge.resume')).toBeInTheDocument();
  });

  it('shows the never-auto-added recommendation note in the missing bucket', () => {
    render(<AtsExplainabilityPanel source={fullSource} context="match" />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByText('sections.explainability.buckets.missing.note')).toBeInTheDocument();
  });

  it('renders nothing when the derived model is empty', () => {
    const { container } = render(
      <AtsExplainabilityPanel
        source={{ realityCheck: null, categoryScores: null, matchedKeywords: [] }}
        context="match"
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('fires a metadata-only analytics event on expand', () => {
    render(<AtsExplainabilityPanel source={fullSource} context="optimize" />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(trackExplainabilityPanelOpened).toHaveBeenCalledTimes(1);
    const payload = trackExplainabilityPanelOpened.mock.calls[0][0];
    expect(payload).toMatchObject({ context: 'optimize', riskTier: 'medium' });
    // no keyword strings / snippets in the payload
    expect(JSON.stringify(payload)).not.toContain('React');
    expect(JSON.stringify(payload)).not.toContain('Managed a team');
  });
});
