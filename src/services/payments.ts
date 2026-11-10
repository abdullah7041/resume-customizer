import { z } from 'zod';
import { supabase } from '@/services/supabase';
import type { PaymentCheckout, PaymentConfig, PaymentStatus } from '@/types/payments';

const endpoint = '/.netlify/functions/payment-checkout';
const environment = z.enum(['sandbox', 'live']);
const configSchema = z.object({ enabled: z.boolean(), priceSar: z.literal(29), credits: z.literal(100), environment });
const checkoutSchema = z.object({
  paymentId: z.uuid(),
  environment,
  checkoutUrl: z.url().refine((value) => {
    const url = new URL(value);
    return url.origin === 'https://www.ksamerchant.geidea.net'
      && url.pathname === '/hpp/checkout/' && !url.username && !url.password
      && /^\?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(url.search) && !url.hash;
  }),
});
const statusSchema = z.object({
  paymentId: z.uuid(),
  status: z.enum(['created', 'pending', 'succeeded', 'failed', 'cancelled', 'refunded']),
  environment,
  creditsGranted: z.boolean(),
  refundedMinor: z.number().int().min(0),
});

let configRequest: Promise<PaymentConfig> | undefined;

/** One public configuration request per page load; unavailable checkout stays closed. */
export function getPaymentConfig(): Promise<PaymentConfig> {
  configRequest ??= (async () => {
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Checkout unavailable');
      return configSchema.parse(await response.json());
    } catch {
      return { enabled: false, priceSar: 29, credits: 100, environment: 'sandbox' };
    }
  })();
  return configRequest;
}

async function paymentRequest(body: Record<string, string>, signal?: AbortSignal): Promise<unknown> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Authentication required');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('Payment request failed');
  return response.json();
}

export async function createPayment(language: 'ar' | 'en'): Promise<PaymentCheckout> {
  return checkoutSchema.parse(await paymentRequest({ action: 'create', language }));
}

export async function readPaymentStatus(paymentId: string, orderId?: string, signal?: AbortSignal): Promise<PaymentStatus> {
  const result = statusSchema.parse(await paymentRequest({ action: 'status', paymentId, ...(orderId ? { orderId } : {}) }, signal));
  if (result.paymentId !== paymentId) throw new Error('Payment reference mismatch');
  return result;
}
