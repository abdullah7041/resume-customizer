import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { auth, config, createPayment, readPaymentStatus, refetch, loadGeideaCheckout } = vi.hoisted(() => ({
  auth: vi.fn(), config: vi.fn(), createPayment: vi.fn(), readPaymentStatus: vi.fn(), refetch: vi.fn(), loadGeideaCheckout: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: auth }));
vi.mock('@/hooks/usePaymentConfig', () => ({ usePaymentConfig: config }));
vi.mock('@/hooks/useUserCredits', () => ({ useUserCredits: () => ({ refetch }) }));
vi.mock('@/services/supabase', () => ({ supabase: {} }));
vi.mock('@/services/payments', async (original) => ({
  ...await original<typeof import('@/services/payments')>(), createPayment, readPaymentStatus,
}));
vi.mock('@/services/geideaCheckout', () => ({ loadGeideaCheckout }));
vi.mock('react-i18next', async () => {
  const { default: en } = await import('@/locales/en/pricing.json');
  return {
    useTranslation: () => ({
      t: (key: string) => {
        const part = key.split('.').at(-1) as keyof typeof en.pricing.checkout;
        return en.pricing.checkout[part] ?? key;
      },
      i18n: { language: 'en' },
    }),
  };
});
import CheckoutPage from '@/pages/CheckoutPage';

const paymentId = '00000000-0000-4000-8000-000000000001';
const pending = { paymentId, status: 'pending', environment: 'live', creditsGranted: false, refundedMinor: 0 };
const successMessage = '100 credits have been added to your account.';

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/checkout');
  sessionStorage.clear();
  auth.mockReturnValue({ user: { id: 'user' }, loading: false, signInWithGoogle: vi.fn() });
  config.mockReturnValue({ enabled: true, priceSar: 29, credits: 100, environment: 'live' });
  refetch.mockResolvedValue(undefined);
  readPaymentStatus.mockResolvedValue(pending);
});

describe('customer checkout', () => {
  it('mounts one embedded session and resumes automatic confirmation after reload', async () => {
    const sessionId = '00000000-0000-4000-8000-000000000002';
    let finish: (response: unknown) => void = () => {};
    const startPayment = vi.fn((_id: string, _options: null, host: string) => {
      document.getElementById(host)?.append(document.createElement('iframe'));
    });
    loadGeideaCheckout.mockResolvedValue(class {
      constructor(onSuccess: typeof finish) { finish = onSuccess; }
      startPayment = startPayment;
    });
    createPayment.mockResolvedValue({ paymentId, sessionId, environment: 'live' });

    const view = render(<StrictMode><CheckoutPage /></StrictMode>);
    expect(await screen.findByTitle('Secure payment')).toBeVisible();
    expect(startPayment).toHaveBeenCalledWith(sessionId, null, 'watheq-payment-form');
    expect(createPayment).toHaveBeenCalledExactlyOnceWith('en');

    act(() => finish({ responseCode: '000' }));
    expect(await screen.findByText('We’re confirming your payment…')).toBeInTheDocument();
    expect(screen.queryByText(successMessage)).not.toBeInTheDocument();
    expect(refetch).not.toHaveBeenCalled();

    view.unmount();
    readPaymentStatus.mockResolvedValue({ ...pending, status: 'succeeded', creditsGranted: true });
    render(<CheckoutPage />);
    expect(await screen.findByText(successMessage)).toBeInTheDocument();
    expect(createPayment).toHaveBeenCalledTimes(1);
    expect(location.search).toBe('');
  });

  it('does not trust a success query string', async () => {
    window.history.replaceState({}, '', `/checkout?payment=${paymentId}&responseCode=000`);
    render(<CheckoutPage />);
    await waitFor(() => expect(readPaymentStatus).toHaveBeenCalled());
    expect(screen.queryByText(successMessage)).not.toBeInTheDocument();
    expect(refetch).not.toHaveBeenCalled();
  });

  it('refreshes the balance after an authoritative live grant', async () => {
    window.history.replaceState({}, '', `/checkout?payment=${paymentId}`);
    readPaymentStatus.mockResolvedValue({ ...pending, status: 'succeeded', creditsGranted: true });
    render(<CheckoutPage />);
    expect(await screen.findByText(successMessage)).toBeInTheDocument();
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
  });

  it('does not claim the original grant after a partial refund', async () => {
    window.history.replaceState({}, '', `/checkout?payment=${paymentId}`);
    readPaymentStatus.mockResolvedValue({ ...pending, status: 'succeeded', creditsGranted: true, refundedMinor: 100 });
    render(<CheckoutPage />);
    expect(await screen.findByText('A refund was recorded for this payment. Check your current credit balance.')).toBeInTheDocument();
    expect(screen.queryByText(successMessage)).not.toBeInTheDocument();
  });

  it('confirms a verified sandbox payment without claiming credits were granted', async () => {
    window.history.replaceState({}, '', `/checkout?payment=${paymentId}`);
    readPaymentStatus.mockResolvedValue({ ...pending, status: 'succeeded', environment: 'sandbox' });
    render(<CheckoutPage />);
    expect(await screen.findByText('Test payment verified. No spendable credits were added.')).toBeInTheDocument();
    expect(screen.queryByText(successMessage)).not.toBeInTheDocument();
    expect(refetch).not.toHaveBeenCalled();
  });

  it('requires sign-in to create a new checkout', () => {
    auth.mockReturnValue({ user: null, loading: false });
    render(<CheckoutPage />);
    expect(screen.getByRole('button', { name: 'Sign in to pay' })).toBeInTheDocument();
    expect(createPayment).not.toHaveBeenCalled();
  });

  it('prevents new checkout creation while disabled', () => {
    config.mockReturnValue({ enabled: false, environment: 'sandbox' });
    render(<CheckoutPage />);
    expect(screen.getByText('Checkout is currently unavailable.')).toBeInTheDocument();
    expect(loadGeideaCheckout).not.toHaveBeenCalled();
    expect(createPayment).not.toHaveBeenCalled();
  });
});
