import { z } from 'zod';
import { geideaGuid, geideaRequest, GeideaError, getGeideaConfig, getPaymentEnvironment } from './geidea.js';
import { getRedis } from './redis-cache.js';
import type { getSupabaseClient } from './supabase-client.js';

const paymentMethod = z.object({
  cardNumber: z.string().regex(/^\d{15,19}$/), cardholderName: z.string().trim().min(1).max(100),
  cvv: z.string().regex(/^\d{3,4}$/), expiryDate: z.object({ month: z.string().regex(/^(0[1-9]|1[0-2])$/), year: z.string().regex(/^\d{2}$/) }).strict(),
}).strict();
const purchase = { paymentId: z.uuid() };
export const directActions = [
  z.object({ action: z.literal('initiate'), ...purchase, cardNumber: paymentMethod.shape.cardNumber }).strict(),
  z.object({ action: z.literal('authenticate'), ...purchase, paymentMethod, language: z.string().max(35), userAgent: z.string().max(1024), timeZone: z.number().int().min(-840).max(840) }).strict(),
  z.object({ action: z.literal('pay'), ...purchase, paymentMethod }).strict(),
] as const;

const ok = { responseCode: z.literal('000'), detailedResponseCode: z.literal('000') };
export async function directPayment(client: NonNullable<ReturnType<typeof getSupabaseClient>>, userId: string, input: z.infer<(typeof directActions)[number]>) {
  if (process.env.GEIDEA_PAYMENTS_ENABLED !== 'true') throw new GeideaError(503, 'payment/disabled', 'Checkout unavailable');
  const { data: row, error } = await client.from('credit_purchases').select('id,environment,status,session_id,order_id,created_at')
    .eq('user_id', userId).eq('id', input.paymentId).maybeSingle();
  if (error) throw new GeideaError(503, 'payment/database', 'Unable to read payment');
  if (!row) throw new GeideaError(404, 'payment/not-found', 'Payment not found');
  if (row.status !== 'pending' || !row.session_id || row.environment !== getPaymentEnvironment() ||
      Date.now() - Date.parse(row.created_at) >= 15 * 60_000) throw new GeideaError(409, 'payment/session-closed', 'Checkout session closed');
  const config = getGeideaConfig();
  const base = { sessionId: row.session_id, source: 'DirectAPI' };
  const urls = { returnUrl: `${config.siteUrl}/.netlify/functions/payment-bank-return?payment=${row.id}&`, callbackUrl: `${config.siteUrl}/.netlify/functions/payment-webhook` };
  if (input.action === 'initiate') {
    if (row.order_id) throw new GeideaError(409, 'payment/already-started', 'Authentication already started');
    const result = z.object({ ...ok, orderId: geideaGuid, redirectHtml: z.string().nullish() }).safeParse(
      await geideaRequest(config, '/pgw/api/v6/direct/authenticate/initiate', { ...base, ...urls, paymentOperation: 'Pay', cardNumber: input.cardNumber }));
    if (!result.success) throw new GeideaError(422, 'payment/authentication', 'Unable to initiate authentication');
    const { data, error: bindError } = await client.from('credit_purchases').update({ order_id: result.data.orderId })
      .eq('id', row.id).is('order_id', null).eq('status', 'pending').select('id').maybeSingle();
    if (bindError || !data) throw new GeideaError(409, 'payment/order-unavailable', 'Unable to bind payment order');
    return { orderId: result.data.orderId, methodHtml: result.data.redirectHtml ?? null };
  }
  if (!row.order_id) throw new GeideaError(409, 'payment/no-order', 'Authentication required');
  const redis = getRedis();
  if (!redis) throw new GeideaError(503, 'payment/unavailable', 'Payment service unavailable');
  const key = `geidea:${row.environment}:${row.id}:${row.order_id}`;
  const order = { ...base, orderId: row.order_id, paymentMethod: input.paymentMethod };
  if (input.action === 'authenticate') {
    const result = z.object({ ...ok, orderId: geideaGuid, gatewayDecision: z.literal('ContinueToPay'), threeDSecureId: geideaGuid, htmlBodyContent: z.string().nullish() }).safeParse(
      await geideaRequest(config, '/pgw/api/v6/direct/authenticate/payer', { ...order, deviceIdentification: { language: input.language, userAgent: input.userAgent }, timeZone: input.timeZone }));
    if (!result.success || result.data.orderId.toLowerCase() !== row.order_id.toLowerCase()) throw new GeideaError(422, 'payment/authentication', 'Authentication failed');
    await redis.set(key, result.data.threeDSecureId, { ex: 900 });
    return { challengeHtml: result.data.htmlBodyContent ?? null };
  }
  const threeDSecureId = await redis.get<string>(key);
  if (!threeDSecureId) throw new GeideaError(409, 'payment/authentication', 'Authentication expired');
  // One capture attempt per order, including when the provider response is lost.
  if (await redis.set(key + ':submitted', '1', { nx: true, ex: 1800 })) {
    await geideaRequest(config, '/pgw/api/v2/direct/pay', { ...order, ...urls, paymentOperation: 'Pay', threeDSecureId });
  }
  return { orderId: row.order_id };
}
