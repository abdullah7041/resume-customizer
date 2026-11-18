import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const paymentConfig = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/usePaymentConfig', () => ({ usePaymentConfig: paymentConfig }));
vi.mock('@/hooks/useUserCredits', () => ({ useUserCredits: () => ({ credits: { remaining: 0, total: 20 } }) }));
vi.mock('../services/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => typeof fallback === 'string' ? fallback : key,
    i18n: { language: 'en', dir: () => 'ltr' },
  }),
}));

import { UpgradeModal } from '../components/Credits/UpgradeModal';
import { ConfirmActionModal } from '../components/Credits/ConfirmActionModal';

beforeEach(() => {
  localStorage.clear();
  paymentConfig.mockReturnValue({ enabled: true, priceSar: 29, credits: 100, environment: 'live' });
});

describe('Credit purchase offer', () => {
  it('opens the credit pack and preserves the dismissal preference', () => {
    const onClose = vi.fn();
    render(<UpgradeModal isOpen onClose={onClose} dismissKey="watheq:test" />);
    expect(screen.getByRole('link', { name: 'Buy 100 credits' })).toHaveAttribute('href', '/checkout');
    expect(screen.getByText('29 SAR · one-time payment')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(localStorage.getItem('watheq:test')).not.toBeNull();
  });

  it('keeps the pack visible while checkout is unavailable', () => {
    paymentConfig.mockReturnValue({ enabled: false, environment: 'live' });
    render(<UpgradeModal isOpen onClose={vi.fn()} dismissKey="" />);
    expect(screen.getByText('29 SAR · one-time payment')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Checkout is currently unavailable.');
    expect(screen.queryByRole('link', { name: 'Buy 100 credits' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('offers checkout when an action exceeds the available credits', () => {
    const onConfirm = vi.fn();
    render(<ConfirmActionModal isOpen onClose={vi.fn()} onConfirm={onConfirm} feature="optimize" />);
    expect(screen.getByRole('link', { name: 'Buy 100 credits' })).toHaveAttribute('href', '/checkout');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
