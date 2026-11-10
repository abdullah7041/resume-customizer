import { createHmac } from 'node:crypto';
import type { HandlerEvent, HandlerResponse } from '@netlify/functions';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const { getUser, from, rpc, getClient } = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), rpc: vi.fn(), getClient: vi.fn() }));
vi.mock('../../lib/supabase-client.js', () => ({ getSupabaseClient: getClient }));
vi.mock('../../lib/rate-limiter.js', () => ({ withRateLimit: (_key: string, handler: unknown) => handler }));
vi.mock('../../lib/credit-manager.js', () => ({ getUserCredits: vi.fn().mockResolvedValue({credits_remaining:20}), isEmailVerified: (u: {email_confirmed_at?:string}) => Boolean(u.email_confirmed_at) }));
const { handler: checkout } = await import('../payment-checkout.js');
const { handler: webhook } = await import('../payment-webhook.js');
const id = '00000000-0000-4000-8000-000000000001';
const orderId = '00000000-0000-4000-8000-000000000002';
const sessionId = '00000000-0000-4000-8000-000000000003';
const publicKey = '00000000-0000-4000-8000-000000000004';
const user = { id, email: 'admin@example.invalid', email_confirmed_at: '2026-11-10T12:00:00Z', app_metadata: {} };
let row: Record<string, unknown> | null;
let dbError: { message: string } | null;

const invoke = async (handler: typeof checkout, body: unknown = { action: 'create', language: 'en' }, auth = 'Bearer token', method = 'POST') => {
  const event = { httpMethod: method, body: typeof body === 'string' ? body : JSON.stringify(body), headers: auth ? { authorization: auth } : {} } as HandlerEvent;
  return await handler(event, {} as never) as HandlerResponse;
};
const order = { orderId, merchantReferenceId: id, merchantPublicKey: publicKey, amount: 29, currency: 'SAR', status: 'Success', detailedStatus: 'Paid', totalCapturedAmount: 29, totalRefundedAmount: 0, isTest: false, paymentMethod: { brand: 'visa' } };
const callback = () => ({ order, timeStamp: '2026-11-10T12:00:00Z', signature: createHmac('sha256', 'password').update(`${publicKey}29.00SAR${orderId}Success${id}2026-11-10T12:00:00Z`).digest('base64') });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('GEIDEA_PAYMENTS_ENABLED', 'true');
  vi.stubEnv('GEIDEA_ENVIRONMENT', 'live');
  vi.stubEnv('GEIDEA_PUBLIC_KEY', publicKey);
  vi.stubEnv('GEIDEA_API_PASSWORD', 'password');
  vi.stubEnv('SITE_URL', 'https://watheq.example');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ responseCode: '000', detailedResponseCode: '000', session: { id: sessionId } }))));
  row = null; dbError = null;
  getUser.mockResolvedValue({ data: { user }, error: null });
  getClient.mockReturnValue({ auth: { getUser }, from, rpc });
  from.mockImplementation(() => {
    let update: Record<string, unknown> | null = null;
    const result = () => {
      if (row && update && !dbError) row = { ...row, ...update };
      return { data: row, error: dbError };
    };
    const query = {
      insert: (input: Record<string, unknown>) => { row = input; return query; },
      update: (input: Record<string, unknown>) => { update = input; return query; },
      select: () => query,
      eq: (key: string, value: unknown) => { if (row && row[key] !== value) row = null; return query; },
      single: async () => result(),
      maybeSingle: async () => result(),
      then: (resolve: (result: unknown) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  });
  rpc.mockResolvedValue({ data: { status: 'succeeded' }, error: null });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('GEIDEA checkout endpoint', () => {
  it('rejects methods, unauthenticated callers, and unverified users', async () => {
    expect((await invoke(checkout, {}, '', 'DELETE')).statusCode).toBe(405);
    expect((await invoke(checkout, {}, '')).statusCode).toBe(401);
    getUser.mockResolvedValue({ data: { user: { ...user, email_confirmed_at: null } }, error: null });
    expect((await invoke(checkout)).statusCode).toBe(403);
    expect(row).toBeNull();
  });
  it('is disabled by default and never calls the provider', async () => {
    vi.stubEnv('GEIDEA_PAYMENTS_ENABLED', '');
    expect((await invoke(checkout)).statusCode).toBe(503);
    expect(row).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['{', { action: 'create', amount: 0.01 }, { action: 'create', language: 'xx' }, { action: 'status', paymentId: 'bad' }])('rejects malformed or price-controlling requests %#', async (body) => {
    expect((await invoke(checkout, body)).statusCode).toBe(400);
    expect(row).toBeNull();
  });
  it('persists an owner-bound payment and returns only the hosted checkout link', async () => {
    const response = await invoke(checkout);
    const body = JSON.parse(response.body!);
    expect(response.statusCode).toBe(200);
    expect(body).toEqual({ paymentId: row?.id, checkoutUrl: `https://www.ksamerchant.geidea.net/hpp/checkout/?${sessionId}`, environment: 'live' });
    expect(row).toMatchObject({ user_id: id, amount_minor: 2900, email: user.email, environment: 'live', currency: 'SAR', status: 'pending', session_id: sessionId });
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)).toMatchObject({ amount: 29, customer: { email: user.email }, callbackUrl: 'https://watheq.example/.netlify/functions/payment-webhook', returnUrl: `https://watheq.example/checkout?payment=${row?.id}` });
    expect(response.body).not.toContain('password');
    expect(response.headers).toMatchObject({ 'Cache-Control': 'no-store' });
  });
  it('does not create a provider session when the initial database write fails', async () => {
    dbError = { message: 'private database detail' };
    const response = await invoke(checkout);
    expect(response.statusCode).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
    expect(response.body).not.toContain('private');
  });
  it('does not expose a checkout when saving the provider session fails', async () => {
    vi.mocked(fetch).mockImplementation(async () => {
      dbError = { message: 'write failed' };
      return new Response(JSON.stringify({ responseCode: '000', detailedResponseCode: '000', session: { id: sessionId } }));
    });
    const response = await invoke(checkout);
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain('checkoutUrl');
  });
  it('returns persisted status without trusting return query parameters or starting a payment', async () => {
    row = { id, user_id: id, status: 'pending', order_id: null, environment: 'live', remaining_credits: 0, granted_at: null, refunded_minor: 0 };
    const response = await invoke(checkout, { action: 'status', paymentId: id });
    expect(JSON.parse(response.body!)).toEqual({ paymentId: id, status: 'pending', orderId: null, environment: 'live', creditsGranted: false, remainingCredits: 0, refundedMinor: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not disclose another owner payment', async () => {
    row = { id, user_id: 'someone-else', status: 'succeeded' };
    expect((await invoke(checkout, { action: 'status', paymentId: id })).statusCode).toBe(404);
  });
  it('exposes only public pack configuration, defaults sandbox, and needs no credentials', async () => {
    vi.stubEnv('GEIDEA_ENVIRONMENT', undefined);
    vi.stubEnv('GEIDEA_PAYMENTS_ENABLED', undefined);
    vi.stubEnv('GEIDEA_API_PASSWORD', undefined);
    const response = await invoke(checkout, {}, '', 'GET');
    expect(JSON.parse(response.body!)).toEqual({ enabled: false, priceSar: 29, credits: 100, environment: 'sandbox' });
    expect(getUser).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not reinterpret a misspelled environment as live or sandbox', async () => {
    vi.stubEnv('GEIDEA_ENVIRONMENT', 'production');
    expect((await invoke(checkout)).statusCode).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not trust an owner-supplied order without authentic reference verification', async () => {
    row = { id, user_id: id, status: 'pending', environment: 'live', session_id: sessionId, order_id: null };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ responseCode: '000', detailedResponseCode: '000', order: { ...order, merchantReferenceId: sessionId } })));
    expect((await invoke(checkout, { action: 'status', paymentId: id, orderId })).statusCode).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('reconciles a provider return via authenticated GET and works while checkout is disabled', async () => {
    vi.stubEnv('GEIDEA_PAYMENTS_ENABLED', 'false');
    row = { id, user_id: id, status: 'pending', environment: 'live', session_id: sessionId, order_id: null, remaining_credits: 0, granted_at: null, refunded_minor: 0 };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ responseCode: '000', detailedResponseCode: '000', order })));
    rpc.mockImplementation(async () => {
      row = { ...row, status: 'succeeded', order_id: orderId, remaining_credits: 100, granted_at: '2026-11-10' };
      return { error: null };
    });
    const response = await invoke(checkout, { action: 'status', paymentId: id, orderId });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body!)).toMatchObject({ status: 'succeeded', creditsGranted: true, remainingCredits: 100 });
    expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe('GET');
  });
  it('returns provider errors without exposing credentials or a checkout URL', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('private password'));
    const response = await invoke(checkout);
    expect(response.statusCode).toBe(502);
    expect(response.body).not.toContain('private');
    expect(response.body).not.toContain('checkoutUrl');
  });
  it('does not reconcile a payment before its session was persisted', async () => {
    row = { id, user_id: id, status: 'created', environment: 'live', session_id: null };
    expect((await invoke(checkout, { action: 'status', paymentId: id, orderId })).statusCode).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('returns refunded status and zero remaining credits after a verified refund reconciliation', async () => {
    row = { id, user_id: id, status: 'succeeded', environment: 'live', session_id: sessionId, order_id: orderId, granted_at: '2026-11-10' };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ responseCode: '000', detailedResponseCode: '000', order: { ...order, totalRefundedAmount: 29 } })));
    rpc.mockImplementation(async () => {
      row = { ...row, status: 'refunded', remaining_credits: 0, refunded_minor: 2900 };
      return { error: null };
    });
    expect(JSON.parse((await invoke(checkout, { action: 'status', paymentId: id })).body!)).toMatchObject({ status: 'refunded', remainingCredits: 0, refundedMinor: 2900 });
  });
});

describe('Customer GEIDEA callback endpoint', () => {
  beforeEach(() => {
    row = { id, user_id: id, status: 'pending', environment: 'live', session_id: sessionId };
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ responseCode: '000', detailedResponseCode: '000', order })));
  });
  it('rejects forged callbacks before any order fetch or persistence', async () => {
    const response = await invoke(webhook, { ...callback(), signature: 'wrong' }, '');
    expect(response.statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('records a verified live order and acknowledges duplicate delivery', async () => {
    expect((await invoke(webhook, callback(), '')).statusCode).toBe(200);
    expect((await invoke(webhook, callback(), '')).statusCode).toBe(200);
    expect(rpc).toHaveBeenCalledWith('record_credit_purchase', { p_purchase_id: id, p_order_id: orderId, p_status: 'succeeded', p_refunded_minor: 0 });
  });
  it('keeps callback processing active after new checkouts are disabled', async () => {
    vi.stubEnv('GEIDEA_PAYMENTS_ENABLED', 'false');
    expect((await invoke(webhook, callback(), '')).statusCode).toBe(200);
  });
  it('fails closed for test orders in live mode', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ responseCode: '000', detailedResponseCode: '000', order: { ...order, isTest: true } })));
    expect((await invoke(webhook, callback(), '')).statusCode).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('requests retry for unknown payments and failed database writes', async () => {
    row = null;
    expect((await invoke(webhook, callback(), '')).statusCode).toBe(503);
    row = { id, session_id: sessionId, environment: 'live' };
    rpc.mockResolvedValue({ data: null, error: { message: 'private detail' } });
    const response = await invoke(webhook, callback(), '');
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain('private');
  });
  it.each([[5, 'succeeded', 500], [29, 'refunded', 2900]])('passes cumulative refunds of %s SAR without treating every refund as full', async (refund, status, minor) => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ responseCode: '000', detailedResponseCode: '000', order: { ...order, totalRefundedAmount: refund, detailedStatus: 'Refunded' } })));
    expect((await invoke(webhook, callback(), '')).statusCode).toBe(200);
    expect(rpc).toHaveBeenCalledWith('record_credit_purchase', { p_purchase_id: id, p_order_id: orderId, p_status: status, p_refunded_minor: minor });
  });
  it.each([{amount:1}, {currency:'USD'}, {merchantPublicKey:sessionId}, {totalRefundedAmount:30}, {totalRefundedAmount:0.001}, {totalCapturedAmount:0,totalRefundedAmount:1}])('rejects mismatched or invalid authenticated money %#', async (patch) => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ responseCode: '000', detailedResponseCode: '000', order: { ...order, ...patch } })));
    expect((await invoke(webhook, callback(), '')).statusCode).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('records sandbox orders without changing their environment to live', async () => {
    row = { id, session_id: sessionId, environment: 'sandbox' };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ responseCode: '000', detailedResponseCode: '000', order: { ...order, isTest: true } })));
    expect((await invoke(webhook, callback(), '')).statusCode).toBe(200);
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ responseCode: '000', detailedResponseCode: '000', order })));
    expect((await invoke(webhook, callback(), '')).statusCode).toBe(409);
  });
});
