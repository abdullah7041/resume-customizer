import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RefundPolicy } from '@/pages/RefundPolicy';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'en' },
  }),
}));

describe('RefundPolicy', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the reviewed effective date instead of the visitor current date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-15T12:00:00Z'));

    render(<RefundPolicy />);

    expect(screen.getByText(/Last Updated:/)).toHaveTextContent('Last Updated: July 12, 2026');
  });
});
