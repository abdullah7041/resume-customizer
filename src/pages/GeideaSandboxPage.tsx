import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';

const checkoutOrigin = 'https://www.ksamerchant.geidea.net';
const checkoutSchema = z.object({ paymentId: z.string().uuid(), checkoutUrl: z.url().refine((value) => {
  const url = new URL(value);
  return url.origin === checkoutOrigin && url.pathname === '/hpp/checkout/' && !url.username && !url.password;
}) });
const statusSchema = z.object({
  paymentId: z.string().uuid(),
  status: z.enum(['created', 'pending', 'succeeded', 'failed', 'cancelled', 'refunded']),
  orderId: z.string().nullable(),
  brand: z.string().nullable(),
});

async function paymentRequest(body: Record<string, string>, signal?: AbortSignal): Promise<unknown> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sign in with an administrator account');
  const response = await fetch('/.netlify/functions/geidea-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(20000),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const failure = z.object({ error: z.object({ message: z.string() }) }).safeParse(data);
    throw new Error(failure.success ? failure.data.error.message : 'Payment request failed');
  }
  return data;
}

// Internal qualification tool; English copy follows the existing /dev/flags
// convention. Checkout itself supports either Arabic or English.
export default function GeideaSandboxPage() {
  const { user, loading } = useAuth();
  const isAdmin = user?.app_metadata?.role === 'admin';
  const [language, setLanguage] = useState<'en' | 'ar'>('en');
  const [paymentId, setPaymentId] = useState(() => {
    const value = new URLSearchParams(window.location.search).get('payment');
    return z.string().uuid().safeParse(value).success ? value : null;
  });
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [result, setResult] = useState<z.infer<typeof statusSchema> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin || !paymentId) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    void paymentRequest({ action: 'status', paymentId }, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult(statusSchema.parse(data));
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Unable to read payment status. Use Refresh status to retry.');
      });
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [isAdmin, paymentId, user?.id]);

  async function createCheckout() {
    setBusy(true); setError(null); setCheckoutUrl(null); setResult(null);
    try {
      const parsed = checkoutSchema.safeParse(await paymentRequest({ action: 'create', language }));
      if (!parsed.success) throw new Error('Invalid checkout response');
      setPaymentId(parsed.data.paymentId);
      setCheckoutUrl(parsed.data.checkoutUrl);
      // Persist the reference in the URL so refresh/back can recover the result.
      window.history.replaceState({}, '', `/dev/payments?payment=${parsed.data.paymentId}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to create checkout');
    } finally { setBusy(false); }
  }

  async function refreshStatus() {
    if (!paymentId) return;
    setBusy(true); setError(null);
    try { setResult(statusSchema.parse(await paymentRequest({ action: 'status', paymentId }))); }
    catch { setError('Unable to read payment status. Try again.'); }
    finally { setBusy(false); }
  }

  if (loading) return <main className="p-8 text-ink" aria-busy="true">Loading…</main>;
  if (!isAdmin) return <main className="p-8 text-ink">Sandbox checkout is restricted to administrators.</main>;

  return (
    <main className="relative z-10 mx-auto w-full max-w-2xl space-y-5 px-4 py-10 text-ink" dir="ltr">
      <h1 className="text-2xl font-semibold">GEIDEA sandbox checkout</h1>
      <p className="text-ink-muted">SAR 1 test payment. No credits or Pro benefits are granted. Use only GEIDEA test cards.</p>
      <section className="space-y-4 rounded-xl border border-line bg-surface p-5">
        <label className="block">
          <span className="mb-2 block">Checkout language</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value === 'ar' ? 'ar' : 'en')} className="rounded-lg border border-line bg-surface px-3 py-2 text-ink">
            <option value="en">English</option><option value="ar">العربية</option>
          </select>
        </label>
        <button type="button" disabled={busy} onClick={() => void createCheckout()} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
          {busy ? 'Working…' : 'Create test checkout'}
        </button>
        {checkoutUrl && <a href={checkoutUrl} className="block font-semibold text-ink-accent underline">Open GEIDEA checkout</a>}
        {paymentId && <div className="space-y-2">
          <p className="break-all text-sm text-ink-muted">Payment reference: {paymentId}</p>
          <button type="button" disabled={busy} onClick={() => void refreshStatus()} className="rounded-lg border border-line px-4 py-2 hover:bg-ink/5 disabled:opacity-50">Refresh status</button>
        </div>}
        {error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
        {result && <div role="status" className="space-y-1">
          <p>Payment status: {result.status}</p>
          {result.orderId && <p className="break-all text-sm text-ink-muted">GEIDEA order: {result.orderId}</p>}
          {result.brand && <p className="text-sm text-ink-muted">Card brand: {result.brand}</p>}
        </div>}
      </section>
      <p className="text-sm text-ink-muted">Status comes from the verified server callback. A return to this page alone does not confirm payment.</p>
      <a href="https://docs.geidea.net/docs/test-cards" target="_blank" rel="noreferrer" className="text-ink-accent underline">Official test cards and expected responses</a>
    </main>
  );
}
