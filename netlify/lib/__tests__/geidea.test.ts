import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCheckoutSession, getGeideaConfig, verifyCallback, verifyOrder } from '../geidea.js';

const reference = '00000000-0000-4000-8000-000000000001';
const orderId = '00000000-0000-4000-8000-000000000002';
// Real sandbox session IDs can use a non-RFC GUID variant (e.g. e43e).
const sessionId = 'b292a50e-ed12-496a-e43e-08df3eb12a82';
const config = { publicKey: reference, apiPassword: 'test-password', siteUrl: 'https://watheq.example' };
const order = {
  orderId, merchantReferenceId: reference, merchantPublicKey: reference,
  amount: 1, currency: 'SAR', status: 'Success', detailedStatus: 'Paid',
  totalCapturedAmount: 1, totalRefundedAmount: 0, isTest: true,
  paymentMethod: { brand: 'mada' },
};
const sign = (data: string) => createHmac('sha256', config.apiPassword).update(data).digest('base64');
const callback = () => ({ order, timeStamp: '2026-11-10T12:00:00Z', signature: sign(`${reference}1.00SAR${orderId}Success${reference}2026-11-10T12:00:00Z`) });

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('GEIDEA gateway boundaries', () => {
  it('requires server-only credentials and an HTTPS site origin', () => {
    vi.stubEnv('GEIDEA_PUBLIC_KEY', reference);
    vi.stubEnv('GEIDEA_API_PASSWORD', config.apiPassword);
    vi.stubEnv('SITE_URL', 'http://localhost:5173');
    expect(() => getGeideaConfig()).toThrow();
    vi.stubEnv('SITE_URL', config.siteUrl);
    expect(getGeideaConfig()).toEqual(config);
    vi.stubEnv('GEIDEA_API_PASSWORD', '');
    expect(() => getGeideaConfig()).toThrow();
  });

  it('creates a fixed-price KSA session with a signed server-owned callback and return URL', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ responseCode: '000', detailedResponseCode: '000', session: { id: sessionId } })));
    expect(await createCheckoutSession(config, reference, 'ar')).toBe(sessionId);
    const [url, request] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://api.ksamerchant.geidea.net/payment-intent/api/v2/direct/session');
    const body = JSON.parse(request?.body as string);
    expect(body).toMatchObject({ amount: 1, currency: 'SAR', language: 'ar', merchantReferenceId: reference, paymentOperation: 'Pay', cardOnFile: false, callbackUrl: 'https://watheq.example/.netlify/functions/geidea-webhook', returnUrl: `https://watheq.example/dev/payments?payment=${reference}` });
    expect(body.signature).toBe(sign(`${reference}1.00SAR${reference}${body.timestamp}`));
    expect(request?.redirect).toBe('error');
    expect(request?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    { responseCode: '100', detailedResponseCode: '000', session: { id: sessionId } },
    { responseCode: '000', detailedResponseCode: '100', session: { id: sessionId } },
    { responseCode: '000', detailedResponseCode: '000', session: { id: 'malformed' } },
  ])('rejects unsuccessful or malformed session responses %#', async (body) => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body)));
    await expect(createCheckoutSession(config, reference, 'en')).rejects.toThrow();
  });

  it('accepts a documented callback signature and rejects amount/status/reference tampering', () => {
    expect(verifyCallback(config, callback()).order.orderId).toBe(orderId);
    for (const patch of [{ amount: 2 }, { status: 'Failed' }, { merchantReferenceId: orderId }]) {
      expect(() => verifyCallback(config, { ...callback(), order: { ...order, ...patch } })).toThrow();
    }
    expect(() => verifyCallback(config, { ...callback(), signature: 'short' })).toThrow();
    expect(() => verifyCallback(config, { ...callback(), signature: `${callback().signature}!` })).toThrow();
  });

  it('accepts lowercase timestamp without changing its signed value', () => {
    const { timeStamp, ...rest } = callback();
    expect(verifyCallback(config, { ...rest, timestamp: timeStamp }).order.orderId).toBe(orderId);
  });

  it('fetches the authenticated order and exposes only the verified payment result', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ responseCode: '000', detailedResponseCode: '000', order })));
    expect(await verifyOrder(config, orderId, reference)).toEqual({ orderId, status: 'succeeded', brand: 'mada' });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(`https://api.ksamerchant.geidea.net/pgw/api/v1/direct/order/${orderId}`);
  });

  it.each([
    { isTest: false }, { isTest: undefined }, { amount: 29 }, { currency: 'EGP' },
    { merchantReferenceId: orderId }, { merchantPublicKey: orderId }, { orderId: reference },
  ])('rejects an order that is not the exact sandbox purchase %#', async (patch) => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ responseCode: '000', detailedResponseCode: '000', order: { ...order, ...patch } })));
    await expect(verifyOrder(config, orderId, reference)).rejects.toThrow();
  });

  it('does not mark authorization-only or partially captured orders paid', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ responseCode: '000', detailedResponseCode: '000', order: { ...order, detailedStatus: 'Authorized', totalCapturedAmount: 0 } })));
    expect(await verifyOrder(config, orderId, reference)).toMatchObject({ status: 'pending' });
  });

  it('recognizes refunds instead of reporting paid', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ responseCode: '000', detailedResponseCode: '000', order: { ...order, totalRefundedAmount: 1 } })));
    expect(await verifyOrder(config, orderId, reference)).toMatchObject({ status: 'refunded' });
  });

  it('hides provider error details', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('private-provider-error', { status: 500 }));
    await expect(createCheckoutSession(config, reference, 'en')).rejects.toThrow('GEIDEA request failed');
  });
});
