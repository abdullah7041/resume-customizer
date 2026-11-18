import { randomUUID } from 'node:crypto';
import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { createCheckoutSession, GEIDEA_CHECKOUT_ORIGIN, GEIDEA_PACK_CREDITS, GEIDEA_PACK_PRICE_SAR, GeideaError, geideaGuid, getGeideaConfig, getPaymentEnvironment, recoverCreditOrder, verifyCreditOrder } from '../lib/geidea.js';
import { getSupabaseClient } from '../lib/supabase-client.js';
import { getUserCredits, isEmailVerified } from '../lib/credit-manager.js';
import { getClientIP } from '../lib/ip-utils.js';
import { withRateLimit } from '../lib/rate-limiter.js';

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const fields = 'id,status,order_id,session_id,environment,remaining_credits,granted_at,refunded_minor,updated_at';
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), language: z.enum(['en', 'ar']).default('en'), embedded: z.boolean().optional() }).strict(),
  z.object({ action: z.literal('status'), paymentId: z.string().uuid(), orderId: geideaGuid.optional(), recover: z.boolean().optional() }).strict(),
]);

const baseHandler: Handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') return { statusCode: 200, headers, body: JSON.stringify({
      enabled: process.env.GEIDEA_PAYMENTS_ENABLED === 'true', priceSar: GEIDEA_PACK_PRICE_SAR,
      credits: GEIDEA_PACK_CREDITS, environment: getPaymentEnvironment(),
    }) };
    if (event.httpMethod !== 'POST') throw new GeideaError(405, 'payment/method-not-allowed', 'Method not allowed');
    const auth = event.headers.authorization ?? event.headers.Authorization;
    if (!auth?.match(/^Bearer\s+\S+$/i)) throw new GeideaError(401, 'payment/unauthenticated', 'Sign in to continue');
    const client = getSupabaseClient();
    if (!client) throw new GeideaError(503, 'payment/unavailable', 'Payment service unavailable');
    const { data: { user }, error: authError } = await client.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
    if (authError || !user) throw new GeideaError(401, 'payment/unauthenticated', 'Sign in to continue');
    if (!user.email || !isEmailVerified(user)) throw new GeideaError(403, 'payment/email-unverified', 'Verify your email before purchasing credits');
    let body: unknown;
    try {
      if (!event.body || event.body.length > 2048 || event.isBase64Encoded) throw new Error();
      body = JSON.parse(event.body);
    } catch {
      throw new GeideaError(400, 'payment/invalid-request', 'Invalid payment request');
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new GeideaError(400, 'payment/invalid-request', 'Invalid payment request');
    if (parsed.data.action === 'status') {
      const { paymentId, orderId, recover } = parsed.data;
      const lookup = () => client.from('credit_purchases').select(fields).eq('id', paymentId).eq('user_id', user.id).maybeSingle();
      let { data: payment, error } = await lookup();
      if (error) throw new GeideaError(503, 'payment/persistence-unavailable', 'Unable to read payment status');
      if (!payment) throw new GeideaError(404, 'payment/not-found', 'Payment not found');
      const recordedOutcome = recover && (
        (payment.status === 'succeeded' && (payment.environment === 'sandbox' || payment.granted_at)) ||
        payment.status === 'refunded' || payment.status === 'failed' || payment.status === 'cancelled'
      );
      const reconcileId = orderId ?? payment.order_id;
      let verified;
      let noOrder = false;
      if (!recordedOutcome && reconcileId) {
        if (!payment.session_id) throw new GeideaError(503, 'payment/persistence-unavailable', 'Payment is not ready; retry status check');
        if (payment.order_id && payment.order_id.toLowerCase() !== reconcileId.toLowerCase()) throw new GeideaError(409, 'payment/order-mismatch', 'Payment order does not match');
        verified = await verifyCreditOrder(getGeideaConfig(), reconcileId, payment.id, z.enum(['sandbox', 'live']).parse(payment.environment));
      } else if (recover && payment.status === 'pending' && payment.session_id) {
        verified = await recoverCreditOrder(getGeideaConfig(), payment.id, z.enum(['sandbox', 'live']).parse(payment.environment));
        noOrder = verified === null;
      }
      if (verified) {
        const { error: recordError } = await client.rpc('record_credit_purchase', {
          p_purchase_id: payment.id, p_order_id: verified.orderId, p_status: verified.status, p_refunded_minor: verified.refundedMinor,
        });
        if (recordError) throw new GeideaError(503, 'payment/persistence-unavailable', 'Unable to save payment status');
        ({ data: payment, error } = await lookup());
        if (error || !payment) throw new GeideaError(503, 'payment/persistence-unavailable', 'Unable to read payment status');
      }
      return { statusCode: 200, headers, body: JSON.stringify({ paymentId: payment.id, status: payment.status, orderId: payment.order_id,
        environment: payment.environment, creditsGranted: payment.environment === 'live' && Boolean(payment.granted_at),
        remainingCredits: payment.remaining_credits, refundedMinor: payment.refunded_minor,
        ...(noOrder ? { noOrder, expired: Date.now() - Date.parse(payment.updated_at) >= 16 * 60 * 1000 } : {}) }) };
    }
    if (process.env.GEIDEA_PAYMENTS_ENABLED !== 'true') throw new GeideaError(503, 'payment/disabled', 'Checkout is currently unavailable');
    const environment = getPaymentEnvironment();
    const config = getGeideaConfig();
    await getUserCredits(user.email, { emailVerified: true, ipAddress: getClientIP(event) });
    const paymentId = randomUUID();
    const { error: insertError } = await client.from('credit_purchases').insert({
      id: paymentId, user_id: user.id, email: user.email, amount_minor: GEIDEA_PACK_PRICE_SAR * 100, currency: 'SAR', environment, status: 'created',
    });
    if (insertError) throw new GeideaError(503, 'payment/persistence-unavailable', 'Unable to save payment');
    const sessionId = await createCheckoutSession(config, paymentId, parsed.data.language, { email: user.email, embedded: parsed.data.embedded });
    const { data, error: updateError } = await client.from('credit_purchases')
      .update({ session_id: sessionId, status: 'pending', updated_at: new Date().toISOString() }).eq('id', paymentId).eq('status', 'created').select('id').single();
    if (updateError || !data) throw new GeideaError(503, 'payment/persistence-unavailable', 'Unable to save checkout session');
    return { statusCode: 200, headers, body: JSON.stringify({ paymentId, sessionId, checkoutUrl: `${GEIDEA_CHECKOUT_ORIGIN}/hpp/checkout/?${sessionId}`, environment }) };
  } catch (error) {
    const failure = error instanceof GeideaError ? error : new GeideaError(500, 'payment/internal-error', 'Unable to process payment request');
    console.warn('[PaymentCheckout]', { status: failure.status, code: failure.code });
    return { statusCode: failure.status, headers, body: JSON.stringify({ error: { status: failure.status, code: failure.code, message: failure.message } }) };
  }
};

export const handler = withRateLimit('payment-checkout', baseHandler);
