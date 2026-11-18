import type { Handler } from '@netlify/functions';
import { z } from 'zod';
import { GeideaError, getGeideaConfig, verifyCallback, verifyCreditOrder } from '../lib/geidea.js';
import { getSupabaseClient } from '../lib/supabase-client.js';

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

// HMAC + known-purchase checks protect this endpoint; provider retries must not
// share the per-IP checkout quota. Process existing purchases even when disabled.
export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') throw new GeideaError(405, 'payment/method-not-allowed', 'Method not allowed');
    let payload: unknown;
    try {
      if (!event.body || event.body.length > 131072 || event.isBase64Encoded) throw new Error();
      payload = JSON.parse(event.body);
    } catch {
      throw new GeideaError(400, 'payment/invalid-callback', 'Invalid callback');
    }
    const config = getGeideaConfig();
    const { order } = verifyCallback(config, payload);
    const client = getSupabaseClient();
    if (!client) throw new GeideaError(503, 'payment/unavailable', 'Payment service unavailable');
    const { data: payment, error } = await client.from('credit_purchases')
      .select('id,session_id,environment,order_id').eq('id', order.merchantReferenceId).maybeSingle();
    if (error || !payment?.session_id) throw new GeideaError(503, 'payment/persistence-unavailable', 'Payment is not ready; retry callback');
    if (payment.order_id && payment.order_id.toLowerCase() !== order.orderId.toLowerCase()) throw new GeideaError(409, 'payment/order-mismatch', 'Payment order does not match');
    const verified = await verifyCreditOrder(config, order.orderId, payment.id, z.enum(['sandbox', 'live']).parse(payment.environment));
    const { error: recordError } = await client.rpc('record_credit_purchase', {
      p_purchase_id: payment.id, p_order_id: verified.orderId, p_status: verified.status, p_refunded_minor: verified.refundedMinor,
    });
    if (recordError) throw new GeideaError(503, 'payment/persistence-unavailable', 'Unable to save payment result; retry callback');
    return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
  } catch (error) {
    const failure = error instanceof GeideaError ? error : new GeideaError(500, 'payment/internal-error', 'Unable to process callback');
    console.warn('[PaymentWebhook]', { status: failure.status, code: failure.code });
    return { statusCode: failure.status, headers, body: JSON.stringify({ error: { status: failure.status, code: failure.code, message: failure.message } }) };
  }
};
