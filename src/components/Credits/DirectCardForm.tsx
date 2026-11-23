import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { createPayment, geideaGuid, paymentRequest } from '@/services/payments';
import { z } from 'zod';

const fieldClass = 'min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink';
const pause = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

async function authenticateBank(bank: Window, markup: string, paymentId: string, signal: AbortSignal) {
  const source = new DOMParser().parseFromString(markup, 'text/html').querySelector<HTMLFormElement>('form[method="post" i]');
  const target = new URL(source?.getAttribute('action') ?? '');
  if (!source || target.protocol !== 'https:' || target.username || target.password) throw new Error('Invalid bank challenge');
  const form = bank.document.createElement('form');
  form.method = 'post';
  form.action = target.href;
  for (const input of source.querySelectorAll<HTMLInputElement>('input[name]')) {
    const field = bank.document.createElement('input');
    field.type = 'hidden';
    field.name = input.name;
    field.value = input.value;
    form.append(field);
  }
  bank.document.body.append(form);
  form.submit();
  const deadline = Date.now() + 5 * 60_000;
  while (!bank.closed && !signal.aborted && Date.now() < deadline) {
    let url: URL | undefined;
    try { url = new URL(bank.location.href); }
    catch { /* The bank owns the popup until it returns to Watheq. */ }
    if (url?.origin === location.origin && url.pathname === '/.netlify/functions/payment-bank-return' &&
        url.searchParams.get('payment') === paymentId) {
      const code = url.searchParams.get('code') ?? url.searchParams.get('?code');
      if (code && code !== '000') throw new Error('Bank authentication failed');
      return;
    }
    await pause(300);
  }
  throw new Error('Bank authentication interrupted');
}

export function DirectCardForm({ language, onSubmitted, remember, onWallet, express }: {
  language: 'ar' | 'en';
  express?: boolean;
  onWallet?: () => void;
  onSubmitted: (paymentId: string, orderId: string) => void;
  remember: (paymentId: string, orderId: string) => void;
}) {
  const { t } = useTranslation();
  const running = useRef<AbortController | null>(null);
  const popup = useRef<Window | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => () => { running.current?.abort(); popup.current?.close(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const cardNumber = String(data.get('number')).replace(/\s/g, '');
    const [month, year] = String(data.get('expiry')).split('/');
    const paymentMethod = { cardNumber, cardholderName: String(data.get('name')).trim(), cvv: String(data.get('cvv')), expiryDate: { month, year } };
    const bank = window.open('about:blank', '_blank', 'popup,width=460,height=650');
    if (!bank) { setError('popup'); return; }
    bank.opener = null;
    bank.document.documentElement.lang = language;
    bank.document.body.textContent = t('pricing.card.bank');
    popup.current = bank;
    const controller = new AbortController();
    running.current = controller;
    setBusy(true);
    setError('');
    try {
      const { paymentId } = await createPayment(language, 'card');
      controller.signal.throwIfAborted();
      const step = (body: Record<string, unknown>) => paymentRequest({ ...body, paymentId }, controller.signal);
      const start = z.object({ orderId: geideaGuid, methodHtml: z.string().nullable() }).parse(await step({ action: 'initiate', cardNumber }));
      if (start.methodHtml) {
        const method = bank.document.createElement('iframe');
        method.sandbox.add('allow-scripts', 'allow-forms');
        method.hidden = true;
        const loaded = new Promise<void>(resolve => { method.onload = () => resolve(); });
        method.srcdoc = start.methodHtml;
        bank.document.body.append(method);
        await Promise.race([loaded, pause(10000)]);
      }
      const auth = z.object({ challengeHtml: z.string().nullable() }).parse(await step({
        action: 'authenticate', paymentMethod, language, userAgent: navigator.userAgent, timeZone: new Date().getTimezoneOffset(),
      }));
      if (auth.challengeHtml) await authenticateBank(bank, auth.challengeHtml, paymentId, controller.signal);
      controller.signal.throwIfAborted();
      remember(paymentId, start.orderId);
      form.reset();
      // From here a lost response may still mean a charge. Always verify this order.
      try { await step({ action: 'pay', paymentMethod }); }
      finally { if (!controller.signal.aborted) onSubmitted(paymentId, start.orderId); }
    } catch {
      if (!controller.signal.aborted) setError('error');
    } finally {
      bank.close();
      popup.current = null;
      running.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return <form className="space-y-3" onSubmit={submit} data-sentry-block>
    <fieldset disabled={busy} className="space-y-3">
      <label className="block">{t('pricing.card.name')}<input className={fieldClass} autoComplete="cc-name" name="name" required maxLength={100} /></label>
      <label className="block">{t('pricing.card.number')}<input className={fieldClass} dir="ltr" autoComplete="cc-number" inputMode="numeric" name="number" required pattern="[0-9 ]{15,23}" maxLength={23} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label>{t('pricing.card.expiry')}<input className={fieldClass} dir="ltr" name="expiry" autoComplete="cc-exp" placeholder="MM/YY" required pattern="(0[1-9]|1[0-2])/[0-9]{2}" maxLength={5} /></label>
        <label>{t('pricing.card.code')}<input className={fieldClass} dir="ltr" name="cvv" autoComplete="cc-csc" inputMode="numeric" type="password" required pattern="[0-9]{3,4}" maxLength={4} /></label>
      </div>
      <button className="min-h-11 w-full rounded-lg bg-emerald-800 font-semibold text-white disabled:opacity-60">{t(busy ? 'pricing.card.bank' : 'pricing.card.pay')}</button>
      {onWallet ? <button type="button" lang={language} onClick={onWallet}
        className={express ? 'watheq-apple-pay min-h-11 w-full rounded-lg bg-black text-white' : 'min-h-11 w-full rounded-lg border border-line'}>
        <span>{t(express ? 'pricing.card.wallet' : 'pricing.card.hosted')}</span>
      </button>
        : <p className="text-sm text-ink-muted">{t('pricing.card.walletDevice')}</p>}
    </fieldset>
    {error && <p role="alert">{t(`pricing.card.${error}`)}</p>}
  </form>;
}
