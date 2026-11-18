import { randomUUID } from 'node:crypto';
import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { createCheckoutSession, GEIDEA_CHECKOUT_ORIGIN, GEIDEA_TEST_AMOUNT, GeideaError, getGeideaConfig } from '../lib/geidea.js';
import { getSupabaseClient } from '../lib/supabase-client.js';
import { withRateLimit } from '../lib/rate-limiter.js';

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), language: z.enum(['en', 'ar']).default('en') }).strict(),
  z.object({ action: z.literal('status'), paymentId: z.string().uuid() }).strict(),
]);

const baseHandler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') throw new GeideaError(405, 'payment/method-not-allowed', 'Method not allowed');
    const auth = event.headers.authorization ?? event.headers.Authorization;
    if (!auth?.match(/^Bearer\s+\S+$/i)) throw new GeideaError(401, 'payment/unauthenticated', 'Sign in to continue');
    const client = getSupabaseClient();
    if (!client) throw new GeideaError(503, 'payment/unavailable', 'Payment service unavailable');
    const { data: { user }, error: authError } = await client.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
    if (authError || !user) throw new GeideaError(401, 'payment/unauthenticated', 'Sign in to continue');
    if (user.app_metadata?.role !== 'admin') throw new GeideaError(403, 'payment/admin-required', 'Sandbox checkout is restricted to administrators');
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
      const { data, error } = await client.from('geidea_sandbox_payments')
        .select('id,status,order_id,brand').eq('id', parsed.data.paymentId).eq('user_id', user.id).maybeSingle();
      if (error) throw new GeideaError(503, 'payment/persistence-unavailable', 'Unable to read payment status');
      if (!data) throw new GeideaError(404, 'payment/not-found', 'Payment not found');
      return { statusCode: 200, headers, body: JSON.stringify({ paymentId: data.id, status: data.status, orderId: data.order_id, brand: data.brand }) };
    }

    if (process.env.GEIDEA_SANDBOX_ENABLED !== 'true') throw new GeideaError(503, 'payment/disabled', 'Sandbox checkout is disabled');
    const config = getGeideaConfig();
    const paymentId = randomUUID();
    const { error: insertError } = await client.from('geidea_sandbox_payments').insert({
      id: paymentId, user_id: user.id, amount_minor: GEIDEA_TEST_AMOUNT * 100, currency: 'SAR', status: 'created',
    });
    if (insertError) throw new GeideaError(503, 'payment/persistence-unavailable', 'Unable to save payment');
    const sessionId = await createCheckoutSession(config, paymentId, parsed.data.language);
    const { data, error: updateError } = await client.from('geidea_sandbox_payments')
      .update({ session_id: sessionId, status: 'pending' }).eq('id', paymentId).eq('status', 'created').select('id').single();
    if (updateError || !data) throw new GeideaError(503, 'payment/persistence-unavailable', 'Unable to save checkout session');
    return { statusCode: 200, headers, body: JSON.stringify({ paymentId, checkoutUrl: `${GEIDEA_CHECKOUT_ORIGIN}/hpp/checkout/?${sessionId}` }) };
  } catch (error) {
    const failure = error instanceof GeideaError ? error : new GeideaError(500, 'payment/internal-error', 'Unable to process payment request');
    console.warn('[GeideaCheckout]', { status: failure.status, code: failure.code });
    return { statusCode: failure.status, headers, body: JSON.stringify({ error: { status: failure.status, code: failure.code, message: failure.message } }) };
  }
};

export const handler = withRateLimit('geidea-checkout', baseHandler);
