import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { usePaymentConfig } from '@/hooks/usePaymentConfig';
import { useUserCredits } from '@/hooks/useUserCredits';
import { createPayment, readPaymentStatus } from '@/services/payments';
import { CreditPack } from '@/components/Credits/CreditPack';
import type { PaymentStatus } from '@/types/payments';

const returnStorageKey = 'watheq:checkoutReturn';
const guid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

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
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const refreshedPayments = useRef(new Set<string>());

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

  async function prepareCheckout() {
    setBusy(true); setError(false);
    try {
      const checkout = await createPayment(i18n.language.startsWith('ar') ? 'ar' : 'en');
      setPaymentId(checkout.paymentId); setCheckoutUrl(checkout.checkoutUrl); setResult(null);
      window.history.replaceState({}, '', `/checkout?payment=${checkout.paymentId}`);
    } catch { setError(true); }
    finally { setBusy(false); }
  }

  async function refreshStatus() {
    if (!paymentId) return;
    setBusy(true); setError(false);
    try { setResult(await readPaymentStatus(paymentId, reference.orderId)); }
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
  const buttonClass = 'min-h-11 rounded-xl border border-line px-5 py-3 font-semibold hover:bg-ink/5 disabled:opacity-50';

  return (
    <main className="relative z-10 mx-auto w-full max-w-2xl space-y-6 px-4 py-10 text-ink" dir={i18n.dir()}>
      <h1 className="text-3xl font-bold">{t('pricing.checkout.title', 'Buy credits')}</h1>
      <section className="space-y-5 rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <CreditPack showCheckoutLink={false} />
        {(config?.environment === 'sandbox' || result?.environment === 'sandbox') && <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-ink">{t('pricing.checkout.sandbox', 'Test mode: use GEIDEA test cards only. This is not a live payment.')}</p>}
        {loading || !config ? <p aria-busy="true">{t('pricing.checkout.loading', 'Loading checkout…')}</p> : !user ? (
          <button type="button" onClick={() => void signIn()} className={buttonClass}>{t('pricing.checkout.signIn', 'Sign in to buy credits or check your payment')}</button>
        ) : canStart ? (
          <button type="button" disabled={busy} onClick={() => void prepareCheckout()} className={buttonClass}>{busy ? t('pricing.checkout.working', 'Working…') : t('pricing.checkout.prepare', 'Prepare secure payment')}</button>
        ) : null}
        {config && !config.enabled && !paymentId && <p>{t('pricing.checkout.disabled', 'Paid checkout is not available yet. You can keep using your free credits.')}</p>}
        {checkoutUrl && <a href={checkoutUrl} className="inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800">{t('pricing.checkout.pay', 'Pay 29 SAR with GEIDEA')}</a>}
        {reference.invalid && <p role="alert">{t('pricing.checkout.invalid', 'This payment reference is invalid. Contact support if you were charged.')}</p>}
        {paymentId && <div className="space-y-3">
          <p className="break-all text-sm text-ink-muted">{t('pricing.checkout.reference', 'Payment reference')}: <bdi>{paymentId}</bdi></p>
          {user && <button type="button" disabled={busy} onClick={() => void refreshStatus()} className={buttonClass}>{busy ? t('pricing.checkout.working', 'Working…') : t('pricing.checkout.retry', 'Check payment status')}</button>}
          <p role="status" aria-live="polite">{result && result.refundedMinor > 0
            ? t('pricing.checkout.refunded', 'This payment has been refunded. Check your current credit balance.') : confirmed
            ? t('pricing.checkout.success', 'Payment verified. Your 100 purchased credits have been added.')
            : result?.status === 'failed' ? t('pricing.checkout.failed', 'Payment failed. No credits were added. You can start a new checkout.')
              : result?.status === 'cancelled' ? t('pricing.checkout.cancelled', 'Payment cancelled. No credits were added. You can start a new checkout.')
                : result?.status === 'refunded' ? t('pricing.checkout.refunded', 'This payment has been refunded. Check your current credit balance.')
                  : t('pricing.checkout.pending', 'Payment is awaiting server confirmation. Check again in a moment before starting another payment.')}</p>
          {result && ['failed', 'cancelled', 'refunded'].includes(result.status) && <a href="/checkout" className="inline-block text-ink-accent underline">{t('pricing.checkout.new', 'Start a new checkout')}</a>}
        </div>}
        {error && <p role="alert" className="text-red-700 dark:text-red-300">{t('pricing.checkout.error', 'We could not verify this request. Try again. If you were charged, check this payment before paying again or contact support.')}</p>}
        <p className="text-sm text-ink-muted">{t('pricing.checkout.verification', 'Returning from GEIDEA does not confirm payment. Credits are added only after the server verifies the payment.')}</p>
        <div className="flex flex-wrap gap-4 text-sm text-ink-accent underline">
          <a href="/refund">{t('pricing.checkout.refundPolicy', 'Refund policy')}</a>
          <a href="/terms">{t('pricing.checkout.terms', 'Terms of service')}</a>
          <a href="mailto:support@watheqai.app">{t('pricing.checkout.support', 'Contact support')}</a>
        </div>
      </section>
      <a href="/" className="text-ink-accent underline">{t('pricing.checkout.back', 'Back to Watheq')}</a>
    </main>
  );
}
