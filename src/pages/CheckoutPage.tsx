import { useEffect, useRef, useState } from 'react';
import { CreditCard, LockKeyhole } from 'lucide-react';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { usePaymentConfig } from '@/hooks/usePaymentConfig';
import { useUserCredits } from '@/hooks/useUserCredits';
import { createPayment, readPaymentStatus } from '@/services/payments';
import { loadGeideaCheckout } from '@/services/geideaCheckout';
import type { PaymentStatus } from '@/types/payments';

const returnStorageKey = 'watheq:checkoutReturn';
const guid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const checkoutContainer = 'geidea-checkout';

export default function CheckoutPage() {
  const { t, i18n } = useTranslation();
  const { user, loading, signInWithGoogle } = useAuth();
  const { refetch } = useUserCredits();
  const config = usePaymentConfig();
  const [reference] = useState(() => {
    const search = window.location.search || sessionStorage.getItem(returnStorageKey) || '';
    const params = new URLSearchParams(search);
    const rawPaymentId = params.get('payment') ?? params.get('paymentId');
    const paymentId = z.uuid().safeParse(rawPaymentId);
    const rawOrderId = params.get('orderId');
    return {
      paymentId: paymentId.success ? paymentId.data : null,
      orderId: rawOrderId && guid.test(rawOrderId) ? rawOrderId : undefined,
      invalid: Boolean(rawPaymentId) && !paymentId.success,
    };
  });
  const [paymentId, setPaymentId] = useState(reference.paymentId);
  const [formOpen, setFormOpen] = useState(false);
  const [cancelledBeforeOrder, setCancelledBeforeOrder] = useState(false);
  const [result, setResult] = useState<PaymentStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const refreshedPayments = useRef(new Set<string>());
  const orderHint = useRef(reference.orderId);
  const starting = useRef(false);

  useEffect(() => {
    if (!user) return;
    window.history.replaceState({}, '', reference.paymentId ? `/checkout?payment=${reference.paymentId}${reference.orderId ? `&orderId=${reference.orderId}` : ''}` : '/checkout');
    sessionStorage.removeItem(returnStorageKey);
    if (!reference.paymentId) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    void readPaymentStatus(reference.paymentId, reference.orderId, controller.signal)
      .then((status) => { if (!controller.signal.aborted) setResult(status); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [reference, user]);

  useEffect(() => {
    if (!result || !['succeeded', 'refunded'].includes(result.status) || !result.creditsGranted) return;
    const refreshKey = `${result.paymentId}:${result.status}:${result.refundedMinor}`;
    if (refreshedPayments.current.has(refreshKey)) return;
    refreshedPayments.current.add(refreshKey);
    void refetch();
  }, [result, refetch]);

  useEffect(() => {
    if (formOpen) document.querySelector<HTMLIFrameElement>(`#${checkoutContainer} iframe`)?.focus({ preventScroll: true });
  }, [formOpen]);

  async function prepareCheckout() {
    if (starting.current || paymentId) return;
    starting.current = true;
    setBusy(true);
    setError(false);
    try {
      const GeideaCheckout = await loadGeideaCheckout();
      const checkout = await createPayment(i18n.language.startsWith('ar') ? 'ar' : 'en');
      const slot = document.getElementById(checkoutContainer);
      if (!slot) return;
      setPaymentId(checkout.paymentId);
      setResult(null);
      window.history.replaceState({}, '', `/checkout?payment=${checkout.paymentId}`);
      let finished = false;
      const close = (response: unknown, cancelled = false) => {
        if (finished || !slot.isConnected) return;
        finished = true;
        const rawOrderId = response && typeof response === 'object' && 'orderId' in response ? response.orderId : null;
        orderHint.current = typeof rawOrderId === 'string' && guid.test(rawOrderId) ? rawOrderId : undefined;
        if (orderHint.current) {
          window.history.replaceState({}, '', `/checkout?payment=${checkout.paymentId}&orderId=${orderHint.current}`);
        }
        setCancelledBeforeOrder(cancelled && !orderHint.current);
        setFormOpen(false);
        void refreshStatus(checkout.paymentId, orderHint.current);
      };
      const payment = new GeideaCheckout(close, close, (response) => close(response, true));
      payment.startPayment(checkout.sessionId, null, checkoutContainer);
      const frame = slot.querySelector('iframe');
      if (!finished && !frame) throw new Error('GEIDEA did not mount the checkout form');
      if (frame) {
        frame.title = t('pricing.checkout.frame', 'Payment form provided by GEIDEA');
        setFormOpen(true);
      }
    } catch {
      setError(true);
    } finally {
      starting.current = false;
      setBusy(false);
    }
  }

  async function refreshStatus(id = paymentId, providerOrderId = orderHint.current) {
    if (!id) return;
    setBusy(true);
    setError(false);
    try { setResult(await readPaymentStatus(id, providerOrderId)); }
    catch { setError(true); }
    finally { setBusy(false); }
  }

  async function signIn() {
    sessionStorage.setItem(returnStorageKey, paymentId ? `?payment=${paymentId}${reference.orderId ? `&orderId=${reference.orderId}` : ''}` : '?checkout=1');
    try { await signInWithGoogle({ intent: 'signin' }); }
    catch { setError(true); }
  }

  const confirmed = result?.status === 'succeeded' && result.creditsGranted && result.refundedMinor === 0;
  const canStart = config?.enabled && !paymentId && !reference.invalid;
  const canRestart = result && (
    ['failed', 'cancelled', 'refunded'].includes(result.status) ||
    (cancelledBeforeOrder && result.status === 'pending' && result.orderId === null)
  );
  const primaryButton = 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-60';

  return (
    <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8 text-ink sm:px-8 sm:py-12" dir={i18n.dir()}>
      <a href="/" className="text-sm font-medium text-ink-accent underline underline-offset-4">{t('pricing.checkout.back', 'Back to Watheq')}</a>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t('pricing.checkout.title', 'Checkout')}</h1>
      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.65fr)]">
        <section aria-labelledby="checkout-summary" className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-7">
          <h2 id="checkout-summary" className="text-lg font-semibold">{t('pricing.checkout.summary', 'Order summary')}</h2>
          <div className="mt-5 space-y-1">
            <p className="font-semibold">{t('pricing.pack.title', 'Application Credits')}</p>
            <p className="text-sm text-ink-muted">{t('pricing.checkout.quantity', '100 credits · No expiry or renewal')}</p>
          </div>
          <div className="mt-5 border-t border-line pt-5">
            <p className="text-sm text-ink-muted">{t('pricing.checkout.total', 'Total due today')}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{t('pricing.checkout.amount', '29 SAR')}</p>
            <p className="mt-1 text-sm text-ink-muted">{t('pricing.checkout.oneTime', 'One-time payment')}</p>
          </div>
        </section>
        <section aria-labelledby="checkout-payment" className="min-w-0 space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-emerald-500/15 p-2 text-ink-accent"><CreditCard className="size-5" aria-hidden="true" /></span>
            <div>
              <h2 id="checkout-payment" className="text-lg font-semibold">{t('pricing.checkout.payment', 'Payment')}</h2>
              <p className="text-sm text-ink-muted">{t('pricing.checkout.processor', 'Card and wallet payments are processed by GEIDEA.')}</p>
            </div>
          </div>
          {(config?.environment === 'sandbox' || result?.environment === 'sandbox') && <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-ink">{t('pricing.checkout.sandbox', 'Test mode: use GEIDEA test cards only. This is not a live payment.')}</p>}
          {loading || !config ? <p aria-busy="true">{t('pricing.checkout.loading', 'Loading checkout…')}</p> : !user ? (
            <button type="button" onClick={() => void signIn()} className={primaryButton}>{t('pricing.checkout.signIn', 'Sign in to buy credits or check your payment')}</button>
          ) : canStart ? (
            <button type="button" disabled={busy} onClick={() => void prepareCheckout()} className={primaryButton}>
              <LockKeyhole className="size-4" aria-hidden="true" />
              {busy ? t('pricing.checkout.opening', 'Opening payment form…') : t('pricing.checkout.prepare', 'Continue to payment')}
            </button>
          ) : null}
          {config && !config.enabled && !paymentId && <p>{t('pricing.checkout.disabled', 'Paid checkout is not available yet. You can keep using your free credits.')}</p>}
          <div id={checkoutContainer} hidden={!formOpen} className="min-w-0 [&_iframe]:block [&_iframe]:w-full [&_iframe]:border-0" />
          {reference.invalid && <p role="alert">{t('pricing.checkout.invalid', 'This payment reference is invalid. Contact support if you were charged.')}</p>}
          {paymentId && user && !formOpen && <div className="space-y-3 rounded-xl border border-line bg-ink/[0.025] p-4">
            <p role="status" aria-live="polite">{result && result.refundedMinor > 0
              ? t('pricing.checkout.refunded', 'This payment has been refunded. Check your current credit balance.') : confirmed
              ? t('pricing.checkout.success', 'Payment verified. Your 100 purchased credits have been added.')
              : result?.status === 'succeeded' && result.environment === 'sandbox'
                ? t('pricing.checkout.sandboxSuccess', 'Test payment verified. No spendable credits were added.')
              : result?.status === 'failed' ? t('pricing.checkout.failed', 'Payment failed. No credits were added. You can start a new checkout.')
                : result?.status === 'cancelled' ? t('pricing.checkout.cancelled', 'Payment cancelled. No credits were added. You can start a new checkout.')
                  : result?.status === 'refunded' ? t('pricing.checkout.refunded', 'This payment has been refunded. Check your current credit balance.')
                    : cancelledBeforeOrder && canRestart ? t('pricing.checkout.closed', 'The payment form was closed before an order was reported.')
                      : !result && !error ? t('pricing.checkout.checking', 'Checking payment status…')
                        : t('pricing.checkout.pending', 'Payment is awaiting server confirmation. Check again in a moment before starting another payment.')}</p>
            <p className="break-all text-xs text-ink-muted">{t('pricing.checkout.reference', 'Payment reference')}: <bdi>{paymentId}</bdi></p>
            {!confirmed && <button type="button" disabled={busy} onClick={() => void refreshStatus()} className="min-h-11 rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-ink/5 disabled:opacity-50">
              {busy ? t('pricing.checkout.working', 'Working…') : t('pricing.checkout.retry', 'Check payment status')}
            </button>}
            {canRestart && <a href="/checkout" className="block text-sm font-medium text-ink-accent underline">{t('pricing.checkout.new', 'Start a new checkout')}</a>}
          </div>}
          {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{paymentId ? t('pricing.checkout.error', 'We could not verify this request. Try again. If you were charged, check this payment before paying again or contact support.') : t('pricing.checkout.openError', 'Checkout could not open. Please try again.')}</p>}
          <p className="text-sm text-ink-muted">{t('pricing.checkout.verification', 'Returning from GEIDEA does not confirm payment. Credits are added only after the server verifies the payment.')}</p>
          <div className="flex flex-wrap gap-4 text-sm text-ink-accent underline">
            <a href="/refund">{t('pricing.checkout.refundPolicy', 'Refund policy')}</a>
            <a href="/terms">{t('pricing.checkout.terms', 'Terms of service')}</a>
            <a href="mailto:support@watheqai.app">{t('pricing.checkout.support', 'Contact support')}</a>
          </div>
        </section>
      </div>
    </main>
  );
}
