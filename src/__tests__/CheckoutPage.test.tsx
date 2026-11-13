import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { auth, config, createPayment, readPaymentStatus, refetch } = vi.hoisted(() => ({
  auth: vi.fn(), config: vi.fn(), createPayment: vi.fn(), readPaymentStatus: vi.fn(), refetch: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: auth }));
vi.mock('@/hooks/usePaymentConfig', () => ({ usePaymentConfig: config }));
vi.mock('@/hooks/useUserCredits', () => ({ useUserCredits: () => ({ refetch }) }));
vi.mock('@/services/payments', () => ({ createPayment, readPaymentStatus }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback, i18n: { language: 'en', dir: () => 'ltr' } }) }));
import CheckoutPage from '@/pages/CheckoutPage';
const paymentId = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/checkout');
  sessionStorage.clear();
  auth.mockReturnValue({ user: { id: 'user' }, loading: false, signInWithGoogle: vi.fn() });
  config.mockReturnValue({ enabled: true, priceSar: 29, credits: 100, environment: 'live' });
  refetch.mockResolvedValue(undefined);
});

describe('customer checkout', () => {
  it('creates checkout only after the customer acts and never grants on link creation', async () => {
    createPayment.mockResolvedValue({ paymentId, checkoutUrl: 'https://www.ksamerchant.geidea.net/hpp/checkout/?provider-session', environment: 'live' });
    render(<CheckoutPage />);
    expect(createPayment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Prepare secure payment' }));
    expect(await screen.findByRole('link', { name: 'Pay 29 SAR with GEIDEA' })).toHaveAttribute('href', 'https://www.ksamerchant.geidea.net/hpp/checkout/?provider-session');
    expect(refetch).not.toHaveBeenCalled();
    expect(createPayment).toHaveBeenCalledWith('en');
  });

  it('does not trust a success query string', async () => {
    window.history.replaceState({}, '', `/checkout?payment=${paymentId}&responseCode=000`);
    readPaymentStatus.mockResolvedValue({ paymentId, status: 'pending', environment: 'live', creditsGranted: false, refundedMinor: 0 });
    render(<CheckoutPage />);
    await waitFor(() => expect(readPaymentStatus).toHaveBeenCalled());
    expect(screen.queryByText('Payment verified. Your 100 purchased credits have been added.')).not.toBeInTheDocument();
    expect(refetch).not.toHaveBeenCalled();
  });

  it('refreshes the balance after an authoritative live grant', async () => {
    window.history.replaceState({}, '', `/checkout?payment=${paymentId}`);
    readPaymentStatus.mockResolvedValue({ paymentId, status: 'succeeded', environment: 'live', creditsGranted: true, refundedMinor: 0 });
    render(<CheckoutPage />);
    expect(await screen.findByText('Payment verified. Your 100 purchased credits have been added.')).toBeInTheDocument();
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
  });

  it('does not claim the original grant after a partial refund', async () => {
    window.history.replaceState({}, '', `/checkout?payment=${paymentId}`);
    readPaymentStatus.mockResolvedValue({ paymentId, status: 'succeeded', environment: 'live', creditsGranted: true, refundedMinor: 100 });
    render(<CheckoutPage />);
    expect(await screen.findByText('This payment has been refunded. Check your current credit balance.')).toBeInTheDocument();
    expect(screen.queryByText('Payment verified. Your 100 purchased credits have been added.')).not.toBeInTheDocument();
  });

  it('confirms a verified sandbox payment without claiming credits were granted', async () => {
    window.history.replaceState({}, '', `/checkout?payment=${paymentId}`);
    readPaymentStatus.mockResolvedValue({ paymentId, status: 'succeeded', environment: 'sandbox', creditsGranted: false, refundedMinor: 0 });
    render(<CheckoutPage />);
    expect(await screen.findByText('Test payment verified. No spendable credits were added.')).toBeInTheDocument();
    expect(screen.queryByText('Payment verified. Your 100 purchased credits have been added.')).not.toBeInTheDocument();
    expect(refetch).not.toHaveBeenCalled();
  });

  it('requires sign-in and prevents checkout creation while disabled', () => {
    config.mockReturnValue({ enabled: false, environment: 'sandbox' });
    auth.mockReturnValue({ user: null, loading: false });
    render(<CheckoutPage />);
    expect(screen.getByRole('button', { name: 'Sign in to buy credits or check your payment' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Prepare secure payment' })).not.toBeInTheDocument();
  });
});
