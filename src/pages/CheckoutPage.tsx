import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { usePaymentConfig } from '@/hooks/usePaymentConfig';
import { useUserCredits } from '@/hooks/useUserCredits';
import { getSkylineUrls } from '@/lib/assets';
import { loadGeideaCheckout } from '@/services/geideaCheckout';
import { createPayment, geideaGuid, PaymentRequestError, readPaymentStatus } from '@/services/payments';
import type { PaymentCheckout, PaymentConfig, PaymentStatus } from '@/types/payments';

import { DirectCardForm } from '@/components/Credits/DirectCardForm';

const returnStorageKey = 'watheq:checkoutReturn';
const containerId = 'watheq-payment-form';
const referenceSchema = z.object({
  paymentId: z.uuid(),
  orderId: geideaGuid.optional(),
  cancelled: z.boolean().optional(),
});
type Reference = z.infer<typeof referenceSchema>;
type CheckoutLanguage = 'ar' | 'en';

function returnedPayment() {
  return new URLSearchParams(window.location.search || sessionStorage.getItem(returnStorageKey) || '');
}

function readReference(ownerId: string): Reference | null {
  const params = returnedPayment();
  const paymentId = params.get('payment') ?? params.get('paymentId');
  const orderId = geideaGuid.safeParse(params.get('orderId')).data;
  const saved = window.history.state?.watheqPayment;
  return referenceSchema.safeParse(paymentId ? { paymentId, orderId } : saved?.ownerId === ownerId ? saved : null).data ?? null;
}

function saveReference(ownerId: string, reference: Reference | null) {
  window.history.replaceState({ ...window.history.state, watheqPayment: reference && { ...reference, ownerId } }, '', '/checkout');
}

function outcome(payment: PaymentStatus, reference: Reference) {
  if (payment.refundedMinor > 0 || payment.status === 'refunded') return 'refunded';
  if (payment.status === 'succeeded') {
    if (payment.environment === 'sandbox') return 'sandboxSuccess';
    if (payment.creditsGranted) return 'success';
  }
  if (payment.status === 'cancelled' || (payment.noOrder && reference.cancelled)) return 'cancelled';
  if (payment.status === 'failed') return 'failed';
  if (payment.noOrder && payment.expired) return 'expired';
  return null;
}

const actionClass = 'inline-flex min-h-11 items-center rounded-xl bg-emerald-800 px-5 py-2.5 font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink-accent';
const linkClass = 'inline-flex min-h-11 items-center rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-accent';

function PaymentPanel({ ownerId, language, config }: { ownerId: string; language: CheckoutLanguage; config: PaymentConfig | null }) {
  const { t } = useTranslation();
  const { refetch } = useUserCredits();
  const [reference, setReference] = useState(() => readReference(ownerId));
  const [lookupError, setLookupError] = useState<'invalid' | 'error' | null>(null);
  const [invalidReturn] = useState(() => {
    const params = returnedPayment();
    return (params.has('payment') || params.has('paymentId')) && !reference;
  });
  const [hosted, setHosted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [formReady, setFormReady] = useState(false);
  const [startupError, setStartupError] = useState(false);
  const [result, setResult] = useState<PaymentStatus | null>(null);
  const [checkingLonger, setCheckingLonger] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const createRequest = useRef<Promise<PaymentCheckout> | null>(null);
  const lastRefreshed = useRef<PaymentStatus | null>(null);
  const enabled = config?.enabled;
  const formTitle = t('pricing.checkout.formTitle');

  useEffect(() => {
    if (reference || !createRequest.current) saveReference(ownerId, reference);
    sessionStorage.removeItem(returnStorageKey);
  }, [ownerId, reference]);

  useEffect(() => {
    const host = hostRef.current;
    if (!hosted || reference || invalidReturn || !enabled || !host) return;
    let active = true;
    let finished = false;

    async function mountForm(container: HTMLDivElement) {
      createRequest.current ??= createPayment(language).catch((error: unknown) => {
        createRequest.current = null;
        throw error;
      });
      const [Checkout, { paymentId, sessionId }] = await Promise.all([
        loadGeideaCheckout(), createRequest.current,
      ]);
      if (!active) return;

      saveReference(ownerId, { paymentId });
      const finish = (payload: unknown, cancelled = false) => {
        if (!active || finished) return;
        finished = true;
        const orderId = z.object({ orderId: geideaGuid }).safeParse(payload).data?.orderId;
        const completed = { paymentId, orderId, cancelled };
        saveReference(ownerId, completed);
        setReference(completed);
      };

      try {
        const checkout = new Checkout(finish, finish, (payload) => finish(payload, true));
        checkout.startPayment(sessionId, null, containerId);
        const iframe = container.querySelector('iframe');
        if (!iframe) {
          setStartupError(true);
          return;
        }
        iframe.title = formTitle;
        if (!finished) setFormReady(true);
      } catch {
        setStartupError(true);
      }
    }

    void mountForm(host).catch(() => {
      if (active) setStartupError(true);
    });
    return () => {
      active = false;
      host.replaceChildren();
    };
  }, [attempt, hosted, enabled, formTitle, invalidReturn, language, ownerId, reference]);

  useEffect(() => {
    if (!reference) return;
    const controller = new AbortController();
    let nextCheck: number | undefined;
    let delay = 2000;
    let orderId = reference.orderId;
    const slowCheck = window.setTimeout(() => setCheckingLonger(true), 60000);

    async function check(payment: Reference) {
      try {
        const status = await readPaymentStatus(payment.paymentId, orderId, controller.signal);
        if (controller.signal.aborted) return;
        setResult(status);
        if (outcome(status, payment)) {
          window.clearTimeout(slowCheck);
          return;
        }
        if (enabled && status.noOrder && status.sessionId && payment.cancelled === undefined && !payment.orderId) {
          createRequest.current = Promise.resolve({ paymentId: payment.paymentId, sessionId: status.sessionId, environment: status.environment });
          setCheckingLonger(false);
          setHosted(true);
          setReference(null);
          return;
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof PaymentRequestError && error.status >= 400 && error.status < 500
          && ![408, 429].includes(error.status) && !(error.status === 409 && orderId)) {
          window.clearTimeout(slowCheck);
          setLookupError(error.status === 404 ? 'invalid' : 'error');
          return;
        }
        // A browser-supplied order hint may be stale. Fall back to Geidea's merchant reference lookup.
        orderId = undefined;
      }
      if (controller.signal.aborted) return;
      nextCheck = window.setTimeout(() => void check(payment), delay);
      delay = Math.min(delay * 2, 30000);
    }

    void check(reference);
    return () => {
      controller.abort();
      window.clearTimeout(nextCheck);
      window.clearTimeout(slowCheck);
    };
  }, [enabled, reference]);

  useEffect(() => {
    if (!result?.creditsGranted || result === lastRefreshed.current) return;
    lastRefreshed.current = result;
    void refetch();
  }, [result, refetch]);

  function retry() {
    if (!startupError) createRequest.current = null;
    setFormReady(false);
    setStartupError(false);
    setResult(null);
    setCheckingLonger(false);
    setReference(null);
    setAttempt((previous) => previous + 1);
  }

  const finalStatus = reference && result ? outcome(result, reference) : null;
  const canRetry = enabled && (startupError || finalStatus === 'failed' || finalStatus === 'cancelled' || finalStatus === 'expired');
  const statusMessage = lookupError ?? (invalidReturn ? 'invalid' : reference
    ? finalStatus ?? (checkingLonger ? 'pendingLonger' : 'pending')
    : !config ? 'loading' : !enabled ? 'disabled' : startupError ? 'error' : hosted && !formReady ? 'loading' : null);
  const isSandbox = (result?.environment ?? config?.environment) === 'sandbox' && Boolean(enabled || result);

  return <>
    {isSandbox && <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-950 dark:bg-amber-900/40 dark:text-amber-100">{t('pricing.checkout.sandbox')}</p>}
    {enabled && !reference && !invalidReturn && !hosted && <DirectCardForm language={language}
      onWallet={() => setHosted(true)}
      remember={(paymentId, orderId) => saveReference(ownerId, { paymentId, orderId })}
      onSubmitted={(paymentId, orderId) => setReference({ paymentId, orderId })} />}
    <div id={containerId} ref={hostRef} className="min-w-0 [&>iframe]:block [&>iframe]:max-w-full [&>iframe]:border-0" hidden={!formReady || Boolean(reference)} />
    <p role="status" className="empty:sr-only">{statusMessage && t(`pricing.checkout.${statusMessage}`)}</p>
    {canRetry && <button type="button" className={actionClass} onClick={retry}>{t('pricing.checkout.new')}</button>}
  </>;
}

export default function CheckoutPage() {
  const { t, i18n } = useTranslation();
  const { user, loading, signInWithGoogle } = useAuth();
  const config = usePaymentConfig();
  const [signInError, setSignInError] = useState(false);
  const language = i18n.resolvedLanguage?.startsWith('ar') || i18n.language?.startsWith('ar') ? 'ar' : 'en';
  const skyline = getSkylineUrls();
  const params = returnedPayment();
  const hasReturn = Boolean(params.get('payment') ?? params.get('paymentId'));

  async function signIn() {
    setSignInError(false);
    sessionStorage.setItem(returnStorageKey, window.location.search || '?checkout=1');
    try { await signInWithGoogle({ intent: 'signin' }); }
    catch { setSignInError(true); }
  }

  return (
    <main lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'} className="relative isolate flex flex-1 items-center justify-center bg-emerald-950 px-3 py-5 text-ink sm:px-8 sm:py-10">
      <picture aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20">
        <source media="(min-width: 768px)" srcSet={skyline.desktop} />
        <img src={skyline.mobile} alt="" className="h-full w-full object-cover" />
      </picture>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-emerald-950/50 md:bg-emerald-950/65" />
      <div className="grid w-full min-w-0 max-w-lg gap-4 rounded-2xl bg-surface-strong p-4 shadow-xl sm:p-6 md:max-w-6xl md:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] md:items-center md:gap-12 md:bg-transparent md:p-0 md:shadow-none">
        <section className="min-w-0 space-y-1.5 md:space-y-4 md:text-white">
          <a href="/" className={linkClass}>{t('pricing.checkout.back')}</a>
          <p className="text-xl font-bold md:text-4xl">{t('common.appName')}</p>
          <h1 className="sr-only md:not-sr-only md:text-xl md:font-semibold">{t('pricing.pack.title')}</h1>
          <p className="text-lg font-semibold md:text-4xl">{t('pricing.checkout.summary')}</p>
          <p className="text-sm text-ink-muted md:text-base md:text-white">{t('pricing.checkout.packNote')}</p>
        </section>
        <section aria-label={t('pricing.checkout.formTitle')} className="min-w-0 space-y-3 md:rounded-2xl md:bg-surface-strong md:p-5 md:shadow-xl">
          {loading ? <p role="status">{t('pricing.checkout.loading')}</p>
            : user ? <PaymentPanel key={user.id} ownerId={user.id} language={language} config={config} />
              : !config ? <p role="status">{t('pricing.checkout.loading')}</p>
                : config.enabled || hasReturn ? <button type="button" className={actionClass} onClick={() => void signIn()}>{t('pricing.checkout.signIn')}</button>
                  : <p role="status">{t('pricing.checkout.disabled')}</p>}
          {signInError && <p role="alert">{t('pricing.checkout.signInError')}</p>}
          <footer className="flex flex-wrap gap-x-4 border-t border-line pt-1 text-sm text-ink-accent">
            <a className={linkClass} href="/refund">{t('pricing.checkout.refundPolicy')}</a>
            <a className={linkClass} href="/terms">{t('pricing.checkout.terms')}</a>
            <a className={linkClass} href="mailto:support@watheqai.app">{t('pricing.checkout.support')}</a>
          </footer>
        </section>
      </div>
    </main>
  );
}
