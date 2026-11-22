import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const API_ORIGIN = 'https://api.ksamerchant.geidea.net';
export const GEIDEA_TEST_AMOUNT = 1;
export const GEIDEA_PACK_PRICE_SAR = 29;
export const GEIDEA_PACK_CREDITS = 100;
export const geideaGuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
export type PaymentEnvironment = 'sandbox' | 'live';
export function getPaymentEnvironment(): PaymentEnvironment {
  const environment = process.env.GEIDEA_ENVIRONMENT ?? 'sandbox';
  if (environment !== 'sandbox' && environment !== 'live') throw new GeideaError(503, 'payment/not-configured', 'Invalid payment environment');
  return environment;
}
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
export async function createCheckoutSession(config: GeideaConfig, reference: string, language: 'ar' | 'en', customerPack?: { email: string; embedded?: boolean }) {
  uuid.parse(reference);
  const amount = customerPack ? GEIDEA_PACK_PRICE_SAR : GEIDEA_TEST_AMOUNT;
  const timestamp = new Date().toISOString();
  const result = await request(config, '/payment-intent/api/v2/direct/session', {
    amount,
    currency: 'SAR',
    timestamp,
    merchantReferenceId: reference,
    signature: signature(config, `${config.publicKey}${amount.toFixed(2)}SAR${reference}${timestamp}`),
    callbackUrl: `${config.siteUrl}/.netlify/functions/${customerPack ? 'payment-webhook' : 'geidea-webhook'}`,
    ...(customerPack?.embedded ? {} : {
      returnUrl: `${config.siteUrl}/${customerPack ? 'checkout' : 'dev/payments'}?payment=${reference}`,
    }),
    paymentOperation: 'Pay',
    cardOnFile: false,
    language,
    ...(customerPack ? { customer: { email: customerPack.email } } : {}),
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

// The authenticated order, never browser/callback claims, determines credit grants.
export async function verifyCreditOrder(config: GeideaConfig, orderId: string, reference: string, environment: PaymentEnvironment) {
  uuid.parse(orderId);
  uuid.parse(reference);
  const result = await request(config, `/pgw/api/v1/direct/order/${orderId}`);
  const parsed = z.object({ ...successCodes, order: creditOrderSchema }).safeParse(result);
  if (!parsed.success) throw new GeideaError(502, 'payment/invalid-order', 'Unable to verify payment order');
  if (parsed.data.order.orderId.toLowerCase() !== orderId.toLowerCase()) {
    throw new GeideaError(409, 'payment/order-mismatch', 'Payment order does not match');
  }
  return creditOrderResult(config, parsed.data.order, reference, environment);
}

const creditOrderSchema = orderSchema.extend({ isTest: z.boolean() });

export async function recoverCreditOrder(config: GeideaConfig, reference: string, environment: PaymentEnvironment) {
  uuid.parse(reference);
  const result = await request(config, `/pgw/api/v1/direct/order?MerchantReferenceId=${reference}`);
  const parsed = z.object({ ...successCodes, orders: z.array(creditOrderSchema).max(1) }).safeParse(result);
  if (!parsed.success) throw new GeideaError(502, 'payment/invalid-order', 'Unable to identify the payment order');
  const [order] = parsed.data.orders;
  return order ? creditOrderResult(config, order, reference, environment) : null;
}

function creditOrderResult(config: GeideaConfig, order: z.infer<typeof creditOrderSchema>, reference: string, environment: PaymentEnvironment) {
  const equalGuid = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const refundedMinor = Math.round(order.totalRefundedAmount * 100);
  if (!equalGuid(order.merchantReferenceId, reference) || !equalGuid(order.merchantPublicKey, config.publicKey) ||
    order.amount !== GEIDEA_PACK_PRICE_SAR || order.currency !== 'SAR' || order.isTest !== (environment === 'sandbox') ||
    order.totalCapturedAmount > GEIDEA_PACK_PRICE_SAR || refundedMinor > GEIDEA_PACK_PRICE_SAR * 100 ||
    Math.abs(order.totalRefundedAmount * 100 - refundedMinor) > 0.000001 || order.totalRefundedAmount > order.totalCapturedAmount) {
    throw new GeideaError(409, 'payment/order-mismatch', 'Payment does not match the checkout');
  }
  const captured = order.totalCapturedAmount === GEIDEA_PACK_PRICE_SAR;
  const status = captured && refundedMinor === GEIDEA_PACK_PRICE_SAR * 100 ? 'refunded'
    : captured && (refundedMinor > 0 || (order.status === 'Success' && order.detailedStatus === 'Paid')) ? 'succeeded'
    : order.status === 'Failed' ? 'failed'
    : ['Cancelled', 'Canceled', 'Expired'].includes(order.status) ? 'cancelled' : 'pending';
  return { orderId: order.orderId, status, refundedMinor };
}

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
