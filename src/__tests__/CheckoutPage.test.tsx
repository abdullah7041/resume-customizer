import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { auth, config, createPayment, readPaymentStatus, refetch, loadExpressCheckout, paymentRequest, loadHostedCheckout } = vi.hoisted(() => ({
  auth: vi.fn(), config: vi.fn(), createPayment: vi.fn(), readPaymentStatus: vi.fn(), refetch: vi.fn(), loadExpressCheckout: vi.fn(), paymentRequest: vi.fn(), loadHostedCheckout: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: auth }));
vi.mock('@/hooks/usePaymentConfig', () => ({ usePaymentConfig: config }));
vi.mock('@/hooks/useUserCredits', () => ({ useUserCredits: () => ({ refetch }) }));
vi.mock('@/services/supabase', () => ({ supabase: {} }));
vi.mock('@/services/payments', async (original) => ({
  ...await original<typeof import('@/services/payments')>(), createPayment, readPaymentStatus, paymentRequest,
}));
vi.mock('@/services/geideaCheckout', () => ({ loadExpressCheckout, loadHostedCheckout }));
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
import { PaymentRequestError } from '@/services/payments';

const mountWallet = (selector: string) => document.querySelector(selector)?.append(document.createElement('iframe'));
const paymentId = '00000000-0000-4000-8000-000000000001';
const pending = { paymentId, status: 'pending', environment: 'live', creditsGranted: false, refundedMinor: 0 };
const successMessage = '100 credits have been added to your account.';

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.stubGlobal('ApplePaySession', { canMakePayments: () => true });
  vi.clearAllMocks();
  paymentRequest.mockResolvedValue(true);
  window.history.replaceState({}, '', '/checkout?walletTest=1');
  sessionStorage.clear();
  auth.mockReturnValue({ user: { id: 'user' }, loading: false, signInWithGoogle: vi.fn() });
  config.mockReturnValue({ enabled: true, priceSar: 29, credits: 100, environment: 'live' });
  refetch.mockResolvedValue(undefined);
  readPaymentStatus.mockResolvedValue(pending);
});

describe('customer checkout', () => {
  it.each(['/checkout', '/checkout?walletTest=1'])('keeps the hosted option for ordinary customers at %s', async path => {
    window.history.replaceState({}, '', path);
    paymentRequest.mockResolvedValue(false);
    loadHostedCheckout.mockResolvedValue(class { startPayment() { mountWallet('#watheq-payment-form'); } });
    createPayment.mockResolvedValue({ paymentId, sessionId: paymentId });
    render(<CheckoutPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'pricing.card.hosted' }));
    await waitFor(() => expect(loadHostedCheckout).toHaveBeenCalledOnce());
    expect(createPayment).toHaveBeenCalledWith('en', 'hosted');
    expect(loadExpressCheckout).not.toHaveBeenCalled();
  });

  it.each([undefined, { canMakePayments: () => false }])('keeps card checkout available on unsupported devices', async (wallet) => {
    vi.stubGlobal('ApplePaySession', wallet);
    render(<CheckoutPage />);
    expect(await screen.findByLabelText('pricing.card.number')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'pricing.card.wallet' })).toBeNull();
    expect(createPayment).not.toHaveBeenCalled();
    expect(loadExpressCheckout).not.toHaveBeenCalled();
  });

  it('mounts one embedded session and resumes automatic confirmation after reload', async () => {
    const sessionId = '00000000-0000-4000-8000-000000000002';
    let finish: (response: unknown) => void = () => {};
    const mount = vi.fn((selector: string) => document.querySelector(selector)?.append(document.createElement('iframe')));
    const create = vi.fn(async (options: { sessionId: string; onSuccess: typeof finish }) => {
      finish = options.onSuccess;
      return { mount };
    });
    loadExpressCheckout.mockResolvedValue(class { create = create; });
    createPayment.mockResolvedValue({ paymentId, sessionId, environment: 'live' });

    const view = render(<StrictMode><CheckoutPage /></StrictMode>);
    expect(await screen.findByLabelText('pricing.card.number')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to Watheq' })).toHaveAttribute('href', '/');
    expect(createPayment).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'pricing.card.wallet' }));
    expect(createPayment).toHaveBeenCalledExactlyOnceWith('en', 'apple-pay');
    await waitFor(() => expect(screen.getByTitle('Apple Pay')).toBeVisible());
    expect(screen.queryByRole('button', { name: 'pricing.card.useCard' })).toBeNull();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ sessionId }));
    expect(mount).toHaveBeenCalledWith('#watheq-payment-form');
    expect(createPayment).toHaveBeenCalledExactlyOnceWith('en', 'apple-pay');

    act(() => finish({ responseCode: '000' }));
    expect(await screen.findByText('We’re confirming your payment…')).toBeInTheDocument();
    expect(screen.queryByText(successMessage)).not.toBeInTheDocument();
    expect(refetch).not.toHaveBeenCalled();

    view.unmount();
    readPaymentStatus.mockResolvedValue({ ...pending, status: 'succeeded', creditsGranted: true });
    render(<CheckoutPage />);
    expect(await screen.findByText(successMessage)).toBeInTheDocument();
    expect(createPayment).toHaveBeenCalledTimes(1);
    expect(location.search).toBe('?walletTest=1');
  });

  it('reopens the same unpaid session after refresh', async () => {
    const sessionId = '00000000-0000-4000-8000-000000000002';
    window.history.replaceState({ watheqPayment: { ownerId: 'user', paymentId, method: 'apple-pay' } }, '', '/checkout?walletTest=1');
    readPaymentStatus.mockResolvedValue({ ...pending, noOrder: true, expired: false, sessionId });
    const create = vi.fn(async () => ({ mount: mountWallet }));
    loadExpressCheckout.mockResolvedValue(class { create = create; });
    render(<CheckoutPage />);
    await waitFor(() => expect(screen.getByTitle('Apple Pay')).toBeVisible());
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ sessionId }));
    expect(createPayment).not.toHaveBeenCalled();
  });

  it.each(['hosted', undefined])('recovers a hosted session after access changes (saved method %s)', async method => {
    window.history.replaceState({ watheqPayment: { ownerId: 'user', paymentId, method } }, '', method ? '/checkout?walletTest=1' : '/checkout');
    readPaymentStatus.mockResolvedValue({ ...pending, noOrder: true, sessionId: paymentId });
    loadHostedCheckout.mockResolvedValue(class { startPayment() { mountWallet('#watheq-payment-form'); } });
    render(<CheckoutPage />);
    await waitFor(() => expect(screen.getByTitle('Secure payment')).toBeVisible());
    expect(loadExpressCheckout).not.toHaveBeenCalled();
    expect(createPayment).not.toHaveBeenCalled();
  });

  it('keeps an ambiguous legacy trial session in reconciliation', async () => {
    window.history.replaceState({ watheqPayment: { ownerId: 'user', paymentId } }, '', '/checkout?walletTest=1');
    readPaymentStatus.mockResolvedValue({ ...pending, noOrder: true, sessionId: paymentId });
    render(<CheckoutPage />);
    await waitFor(() => expect(readPaymentStatus).toHaveBeenCalled());
    expect(screen.getByText('We’re confirming your payment…')).toBeVisible();
    expect(loadHostedCheckout).not.toHaveBeenCalled();
    expect(loadExpressCheckout).not.toHaveBeenCalled();
  });

  it('offers another method only after a wallet error reconciles to no order', async () => {
    let fail!: (payload: unknown) => void;
    let reconcile!: (status: typeof pending & { noOrder: boolean }) => void;
    loadExpressCheckout.mockResolvedValue(class {
      async create(options: { onError: typeof fail }) { fail = options.onError; return { mount: mountWallet }; }
    });
    createPayment.mockResolvedValue({ paymentId, sessionId: paymentId });
    readPaymentStatus.mockImplementation(() => new Promise(resolve => { reconcile = resolve; }));
    render(<CheckoutPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'pricing.card.wallet' }));
    await screen.findByTitle('Apple Pay');
    act(() => fail({}));
    await waitFor(() => expect(readPaymentStatus).toHaveBeenCalled());
    expect(window.history.state.watheqPayment).toMatchObject({ paymentId, method: 'apple-pay', callback: 'error' });
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.queryByLabelText('pricing.card.number')).toBeNull();
    await act(async () => reconcile({ ...pending, noOrder: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('pricing.card.number')).toBeVisible();
    expect(createPayment).toHaveBeenCalledTimes(1);
  });

  it('retries an SDK startup failure with the original unpaid session', async () => {
    const sessionId = '00000000-0000-4000-8000-000000000002';
    createPayment.mockResolvedValue({ paymentId, sessionId, environment: 'live' });
    loadExpressCheckout.mockResolvedValueOnce(class { create() { throw new Error('SDK unavailable'); } })
      .mockResolvedValueOnce(class { async create() { return { mount: mountWallet }; } });
    render(<CheckoutPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'pricing.card.wallet' }));
    expect(await screen.findByRole('button', { name: 'pricing.card.useCard' })).toBeVisible();
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByTitle('Apple Pay')).toBeVisible());
    expect(createPayment).toHaveBeenCalledTimes(1);
    expect(readPaymentStatus).not.toHaveBeenCalled();
  });

  it('shows the missing purchase message for a permanent lookup failure', async () => {
    window.history.replaceState({}, '', `/checkout?payment=${paymentId}`);
    readPaymentStatus.mockRejectedValue(new PaymentRequestError(404, 'payment/not-found', 'Payment not found'));
    render(<CheckoutPage />);
    expect(await screen.findByText(/couldn’t find this payment/i)).toBeVisible();
    expect(createPayment).not.toHaveBeenCalled();
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

  it('prevents new checkout creation while disabled', async () => {
    config.mockReturnValue({ enabled: false, environment: 'sandbox' });
    render(<CheckoutPage />);
    expect(await screen.findByText('Checkout is currently unavailable.')).toBeInTheDocument();
    expect(loadExpressCheckout).not.toHaveBeenCalled();
    expect(createPayment).not.toHaveBeenCalled();
  });
});
