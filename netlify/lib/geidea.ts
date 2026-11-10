import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const API_ORIGIN = 'https://api.ksamerchant.geidea.net';
export const GEIDEA_TEST_AMOUNT = 1;
export const GEIDEA_CHECKOUT_ORIGIN = 'https://www.ksamerchant.geidea.net';
// GEIDEA/.NET GUIDs are not always RFC-variant UUIDs. Keep the exact signed
// spelling while validating the hexadecimal shape before building API paths.
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const configSchema = z.object({ publicKey: uuid, apiPassword: z.string().min(1), siteUrl: z.url() });
export type GeideaConfig = z.infer<typeof configSchema>;

export class GeideaError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'GeideaError';
  }
}

export function getGeideaConfig(): GeideaConfig {
  const parsed = configSchema.safeParse({
    publicKey: process.env.GEIDEA_PUBLIC_KEY,
    apiPassword: process.env.GEIDEA_API_PASSWORD,
    siteUrl: process.env.SITE_URL,
  });
  if (!parsed.success) throw new GeideaError(503, 'payment/not-configured', 'Payment service is not configured');
  const url = new URL(parsed.data.siteUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new GeideaError(503, 'payment/not-configured', 'Payment service requires an HTTPS site origin');
  }
  return { ...parsed.data, siteUrl: url.origin };
}

function signature(config: GeideaConfig, data: string) {
  return createHmac('sha256', config.apiPassword).update(data).digest('base64');
}

async function request(config: GeideaConfig, path: string, body?: unknown): Promise<unknown> {
  try {
    const response = await fetch(`${API_ORIGIN}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${config.publicKey}:${config.apiPassword}`).toString('base64')}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Provider response failed');
    return await response.json();
  } catch {
    throw new GeideaError(502, 'payment/provider-unavailable', 'GEIDEA request failed');
  }
}

const successCodes = { responseCode: z.literal('000'), detailedResponseCode: z.literal('000') };
export async function createCheckoutSession(config: GeideaConfig, reference: string, language: 'ar' | 'en') {
  uuid.parse(reference);
  const timestamp = new Date().toISOString();
  const result = await request(config, '/payment-intent/api/v2/direct/session', {
    amount: GEIDEA_TEST_AMOUNT,
    currency: 'SAR',
    timestamp,
    merchantReferenceId: reference,
    signature: signature(config, `${config.publicKey}${GEIDEA_TEST_AMOUNT.toFixed(2)}SAR${reference}${timestamp}`),
    callbackUrl: `${config.siteUrl}/.netlify/functions/geidea-webhook`,
    returnUrl: `${config.siteUrl}/dev/payments?payment=${reference}`,
    paymentOperation: 'Pay',
    cardOnFile: false,
    language,
  });
  const parsed = z.object({ ...successCodes, session: z.object({ id: uuid }) }).safeParse(result);
  if (!parsed.success) throw new GeideaError(502, 'payment/session-failed', 'Unable to create checkout session');
  return parsed.data.session.id;
}

const signedOrderSchema = z.object({
  orderId: uuid,
  merchantReferenceId: uuid,
  amount: z.number().positive().finite(),
  currency: z.string().length(3),
  status: z.string().min(1).max(64),
});
const callbackSchema = z.object({
  order: signedOrderSchema,
  signature: z.string().regex(/^[A-Za-z0-9+/]{43}=$/),
  timeStamp: z.string().min(1).max(100).optional(),
  timestamp: z.string().min(1).max(100).optional(),
});

export function verifyCallback(config: GeideaConfig, payload: unknown) {
  const parsed = callbackSchema.safeParse(payload);
  if (!parsed.success) throw new GeideaError(400, 'payment/invalid-callback', 'Invalid callback');
  const { order, signature: supplied, timeStamp, timestamp } = parsed.data;
  const time = timeStamp ?? timestamp;
  if (!time || (timeStamp && timestamp && timeStamp !== timestamp)) {
    throw new GeideaError(400, 'payment/invalid-callback', 'Invalid callback timestamp');
  }
  const expected = signature(config, `${config.publicKey}${order.amount.toFixed(2)}${order.currency}${order.orderId}${order.status}${order.merchantReferenceId}${time}`);
  if (!timingSafeEqual(Buffer.from(expected, 'base64'), Buffer.from(supplied, 'base64'))) {
    throw new GeideaError(401, 'payment/invalid-signature', 'Invalid callback signature');
  }
  return { order };
}

const orderSchema = signedOrderSchema.extend({
  merchantPublicKey: uuid,
  isTest: z.literal(true),
  detailedStatus: z.string(),
  totalCapturedAmount: z.number().nonnegative(),
  totalRefundedAmount: z.number().nonnegative(),
  paymentMethod: z.object({ brand: z.string().max(64).nullable().optional() }).nullable().optional(),
});

export async function verifyOrder(config: GeideaConfig, orderId: string, reference: string) {
  uuid.parse(orderId);
  uuid.parse(reference);
  const result = await request(config, `/pgw/api/v1/direct/order/${orderId}`);
  const parsed = z.object({ ...successCodes, order: orderSchema }).safeParse(result);
  if (!parsed.success) throw new GeideaError(502, 'payment/invalid-order', 'Unable to verify sandbox order');
  const order = parsed.data.order;
  if (order.orderId !== orderId || order.merchantReferenceId !== reference || order.merchantPublicKey !== config.publicKey ||
    order.amount !== GEIDEA_TEST_AMOUNT || order.currency !== 'SAR') {
    throw new GeideaError(409, 'payment/order-mismatch', 'Payment does not match the sandbox checkout');
  }
  const status = order.totalRefundedAmount > 0 ? 'refunded'
    : order.status === 'Success' && order.detailedStatus === 'Paid' && order.totalCapturedAmount === GEIDEA_TEST_AMOUNT ? 'succeeded'
    : order.status === 'Failed' ? 'failed'
    : ['Cancelled', 'Canceled', 'Expired'].includes(order.status) ? 'cancelled' : 'pending';
  return { orderId, status, brand: order.paymentMethod?.brand ?? null };
}
