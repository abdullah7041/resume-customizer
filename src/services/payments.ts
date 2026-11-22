import { z } from 'zod';
import { supabase } from '@/services/supabase';
import type { PaymentCheckout, PaymentConfig, PaymentStatus } from '@/types/payments';

const endpoint = '/.netlify/functions/payment-checkout';
export const geideaGuid = z.string().regex(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);
const environment = z.enum(['sandbox', 'live']);
const configSchema = z.object({ enabled: z.boolean(), priceSar: z.literal(29), credits: z.literal(100), environment });
const checkoutSchema = z.object({
  paymentId: z.uuid(),
  environment,
  sessionId: geideaGuid,
});
const statusSchema = z.object({
  paymentId: z.uuid(),
  status: z.enum(['created', 'pending', 'succeeded', 'failed', 'cancelled', 'refunded']),
  environment,
  creditsGranted: z.boolean(),
  refundedMinor: z.number().int().min(0),
  sessionId: geideaGuid.optional(),
  noOrder: z.boolean().optional(),
  expired: z.boolean().optional(),
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

export class PaymentRequestError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function paymentRequest(body: Record<string, string | boolean>, signal?: AbortSignal): Promise<unknown> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new PaymentRequestError(401, 'payment/unauthorized', 'Authentication required');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
    signal: signal && typeof AbortSignal.any === 'function'
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : signal ?? AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const failure = z.object({ error: z.object({ code: z.string(), message: z.string() }) })
      .safeParse(await response.json().catch(() => null)).data?.error;
    throw new PaymentRequestError(response.status, failure?.code ?? 'payment/request-failed', failure?.message ?? 'Payment request failed');
  }
  return response.json();
}

export async function createPayment(language: 'ar' | 'en'): Promise<PaymentCheckout> {
  return checkoutSchema.parse(await paymentRequest({ action: 'create', language, embedded: true }));
}

export async function readPaymentStatus(paymentId: string, orderId?: string, signal?: AbortSignal): Promise<PaymentStatus> {
  const result = statusSchema.parse(await paymentRequest({ action: 'status', paymentId, recover: true, ...(orderId ? { orderId } : {}) }, signal));
  if (result.paymentId !== paymentId) throw new Error('Payment reference mismatch');
  return result;
}
