import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Vision2030CalculationModal } from '@/components/ui/Vision2030CalculationModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe('Vision2030CalculationModal', () => {
  it('describes the active AI analysis without false local or deterministic formulas', () => {
    render(<Vision2030CalculationModal isOpen onClose={vi.fn()} />);

    expect(screen.getByText(/AI-generated estimate/i)).toBeInTheDocument();
    expect(screen.getAllByText(/resume evidence/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/not an official Vision 2030 certification/i)).toBeInTheDocument();
    expect(screen.queryByText(/60% motivational floor/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/70\/30 rule/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/locally on your device/i)).not.toBeInTheDocument();
  });
});
