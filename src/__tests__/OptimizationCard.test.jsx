import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OptimizationCard from '../components/shared/OptimizationCard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en' },
  }),
}));

afterEach(cleanup);

const baseCard = {
  section: 'Experience',
  issue: 'Bullet lacks impact.',
  suggestion: 'Use STAR format with quantified results.',
  exampleBefore: 'Worked on web projects.',
  exampleAfter: 'Led migration of 3 web services, cutting load time by 40%.',
};

describe('OptimizationCard source_span evidence disclosure', () => {
  it('shows evidence through an accessible disclosure when evidence metadata is present', () => {
    render(<OptimizationCard card={{ ...baseCard, evidence: 'Worked on web projects' }} onCopy={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: 'Grounded in your resume' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('note')).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('note')).toHaveTextContent('Worked on web projects');
  });

  it('renders no evidence disclosure when evidence is absent or empty', () => {
    const { rerender } = render(<OptimizationCard card={baseCard} onCopy={vi.fn()} />);

    expect(screen.queryByText('Grounded in your resume')).not.toBeInTheDocument();
    expect(screen.getByText('Led migration of 3 web services, cutting load time by 40%.')).toBeInTheDocument();

    rerender(<OptimizationCard card={{ ...baseCard, evidence: '' }} onCopy={vi.fn()} />);

    expect(screen.queryByText('Grounded in your resume')).not.toBeInTheDocument();
  });
});
