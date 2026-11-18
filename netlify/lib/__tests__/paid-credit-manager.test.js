import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({ db: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => db }));
vi.mock('../referral-manager.js', () => ({ completeReferral: async () => ({ completed: false }) }));
import { addCredits, consumeCredits } from '../credit-manager.js';

beforeEach(() => {
  vi.stubEnv('GEIDEA_PAYMENTS_ENABLED', 'true');
  vi.resetAllMocks();
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
  db.from.mockReturnValue({
    select: () => ({ eq: () => ({ single: async () => ({ data: { credits_remaining: 110 } }) }) }),
    insert: async () => ({ error: null }),
  });
});
afterEach(() => vi.unstubAllEnvs());

describe('paid credit accounting boundary', () => {
  it('uses the locked RPC balance rather than a stale read', async () => {
    db.rpc.mockResolvedValue({ data: 100, error: null });
    expect(await consumeCredits('u@example.com', 'optimize')).toEqual({ success: true, creditsRemaining: 100 });
  });

  it('fails closed when the consumption RPC is missing', async () => {
    db.rpc.mockResolvedValue({ error: { code: '42883' } });
    await expect(consumeCredits('u@example.com', 'optimize')).rejects.toMatchObject({ code: 'CONSUME_CREDITS_RPC_FAILED' });
    expect(db.from).toHaveBeenCalledTimes(1);
  });

  it('returns the exact debit receipt for the feature that may refund', async () => {
    db.rpc.mockResolvedValue({ data: { credits_remaining: 108, debit_id: 'receipt-id' }, error: null });
    expect(await consumeCredits('u@example.com', 'vision2030')).toEqual({ success: true, creditsRemaining: 108, debitId: 'receipt-id' });
    expect(db.rpc).toHaveBeenCalledWith('consume_user_credits_with_receipt', { p_email: 'u@example.com', p_amount: 2 });
  });

  it('restores a failed action by its receipt, not as new free credits', async () => {
    db.rpc.mockResolvedValue({ data: { credits_remaining: 110 }, error: null });
    expect(await addCredits('u@example.com', 2, 'refund', { debitId: 'receipt-id' })).toEqual({ success: true, creditsRemaining: 110 });
    expect(db.rpc).toHaveBeenCalledWith('refund_credit_debit', { p_email: 'u@example.com', p_debit_id: 'receipt-id' });
  });

  it('keeps purchased-credit accounting active after checkout is disabled', async () => {
    vi.stubEnv('GEIDEA_PAYMENTS_ENABLED', 'false');
    db.from.mockReturnValue({
      select: () => ({ eq: () => ({ single: async () => ({ data: { credits_remaining: 110, purchased_credits_remaining: 100 } }) }) }),
      insert: async () => ({ error: null }),
    });
    db.rpc.mockResolvedValue({ data: { credits_remaining: 108, debit_id: 'receipt-id' }, error: null });
    expect(await consumeCredits('u@example.com', 'vision2030')).toEqual({ success: true, creditsRemaining: 108, debitId: 'receipt-id' });
    db.rpc.mockResolvedValue({ data: { credits_remaining: 110 }, error: null });
    expect(await addCredits('u@example.com', 2, 'refund', { debitId: 'receipt-id' })).toEqual({ success: true, creditsRemaining: 110 });
  });

  it('rejects refunds without the original debit receipt', async () => {
    await expect(addCredits('u@example.com', 2, 'refund')).rejects.toMatchObject({ code: 'CREDIT_REFUND_RECEIPT_REQUIRED' });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it('fails closed when a reward RPC is missing', async () => {
    db.rpc.mockResolvedValue({ error: { code: '42883' } });
    await expect(addCredits('u@example.com', 1, 'feedback_reward')).rejects.toMatchObject({ code: 'ADD_CREDITS_RPC_FAILED' });
    expect(db.from).not.toHaveBeenCalled();
  });
});
