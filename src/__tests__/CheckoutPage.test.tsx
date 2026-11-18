import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
const sessionId = 'b292a50e-ed12-496a-e43e-08df3eb12a82';
const orderId = '00000000-0000-4000-8000-000000000002';
const startPayment = vi.fn();
let notifyPayment: (result: unknown) => void;
let cancelPayment: (result: unknown) => void;

function stubGeideaCheckout() {
  vi.stubGlobal('GeideaCheckout', class {
    constructor(onSuccess: (result: unknown) => void, _onError: (result: unknown) => void, onCancel: (result: unknown) => void) {
      notifyPayment = onSuccess;
      cancelPayment = onCancel;
    }
    startPayment = startPayment;
  });
  startPayment.mockImplementation((_session, _options, target: string) => {
    document.getElementById(target)?.appendChild(document.createElement('iframe'));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/checkout');
  sessionStorage.clear();
  auth.mockReturnValue({ user: { id: 'user' }, loading: false, signInWithGoogle: vi.fn() });
  config.mockReturnValue({ enabled: true, priceSar: 29, credits: 100, environment: 'live' });
  refetch.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());

describe('customer checkout', () => {
  it('opens the GEIDEA form on Watheq and treats SDK success as a verification hint', async () => {
    createPayment.mockResolvedValue({ paymentId, sessionId, environment: 'live' });
    readPaymentStatus.mockResolvedValue({ paymentId, status: 'pending', environment: 'live', creditsGranted: false, refundedMinor: 0 });
    stubGeideaCheckout();
    render(<CheckoutPage />);
    expect(createPayment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to payment' }));
    expect(await screen.findByTitle('Payment form provided by GEIDEA')).toBeVisible();
    expect(startPayment).toHaveBeenCalledWith(sessionId, null, 'geidea-checkout');
    expect(createPayment).toHaveBeenCalledWith('en');
    expect(window.location.pathname).toBe('/checkout');
    expect(screen.queryByRole('link', { name: /pay.*geidea/i })).not.toBeInTheDocument();
    expect(readPaymentStatus).not.toHaveBeenCalled();
    await act(async () => notifyPayment({ responseCode: '000', orderId }));
    expect(readPaymentStatus).toHaveBeenCalledWith(paymentId, orderId);
    expect(refetch).not.toHaveBeenCalled();
  });

  it('allows a new checkout after closing the form and confirming that no order is recorded', async () => {
    createPayment.mockResolvedValue({ paymentId, sessionId, environment: 'live' });
    readPaymentStatus.mockResolvedValue({ paymentId, orderId: null, status: 'pending', environment: 'live', creditsGranted: false, refundedMinor: 0 });
    stubGeideaCheckout();
    render(<CheckoutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue to payment' }));
    expect(await screen.findByTitle('Payment form provided by GEIDEA')).toBeVisible();
    await act(async () => cancelPayment({ orderId: null }));
    expect(readPaymentStatus).toHaveBeenCalledWith(paymentId, undefined);
    expect(screen.getByRole('link', { name: 'Start a new checkout' })).toHaveAttribute('href', '/checkout');
    expect(refetch).not.toHaveBeenCalled();
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
    expect(screen.queryByRole('button', { name: 'Continue to payment' })).not.toBeInTheDocument();
  });
});
