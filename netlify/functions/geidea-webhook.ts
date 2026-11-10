import type { Handler } from '@netlify/functions';
import { GeideaError, getGeideaConfig, verifyCallback, verifyOrder } from '../lib/geidea.js';
import { getSupabaseClient } from '../lib/supabase-client.js';

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

// Do not apply per-IP user rate limits to provider retries. The bounded body,
// HMAC check, and known-payment lookup all precede the external order request.
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
    const { data: payment, error } = await client.from('geidea_sandbox_payments')
      .select('id,session_id').eq('id', order.merchantReferenceId).maybeSingle();
    if (error || !payment?.session_id) throw new GeideaError(503, 'payment/persistence-unavailable', 'Payment is not ready; retry callback');
    const verified = await verifyOrder(config, order.orderId, payment.id);
    const { error: recordError } = await client.rpc('record_geidea_sandbox_result', {
      p_payment_id: payment.id, p_order_id: verified.orderId, p_status: verified.status, p_brand: verified.brand,
    });
    if (recordError) throw new GeideaError(503, 'payment/persistence-unavailable', 'Unable to save payment result; retry callback');
    return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
  } catch (error) {
    const failure = error instanceof GeideaError ? error : new GeideaError(500, 'payment/internal-error', 'Unable to process callback');
    console.warn('[GeideaWebhook]', { status: failure.status, code: failure.code });
    return { statusCode: failure.status, headers, body: JSON.stringify({ error: { status: failure.status, code: failure.code, message: failure.message } }) };
  }
};
