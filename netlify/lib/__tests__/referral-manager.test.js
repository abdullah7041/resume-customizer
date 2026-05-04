import { afterEach, describe, expect, it, vi } from 'vitest';

const { addCreditsMock, supabaseMock } = vi.hoisted(() => ({
  addCreditsMock: vi.fn(),
  supabaseMock: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => supabaseMock),
}));

vi.mock('../credit-manager.js', () => ({
  addCredits: addCreditsMock,
}));

vi.mock('../sentry.js', () => ({
  redactForLog: vi.fn((value) => value),
}));

const originalEnv = { ...process.env };

async function importFreshReferralManager() {
  vi.resetModules();
  return import('../referral-manager.js');
}

function mockSelectSingle(result) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue(result),
      })),
    })),
  };
}

function mockConditionalReferralUpdate(result) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const is = vi.fn(() => ({ select }));
  const eq = vi.fn(() => ({ is }));
  const update = vi.fn(() => ({ eq }));

  return {
    table: { update },
    spies: { update, eq, is, select, maybeSingle },
  };
}

describe('ReferralManager server config', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it('fails closed when SUPABASE_URL is missing', async () => {
    delete process.env.SUPABASE_URL;
    process.env.VITE_SUPABASE_URL = 'https://fallback.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    const { getReferralStats } = await importFreshReferralManager();

    await expect(getReferralStats('user@example.com')).rejects.toThrow(
      '[ReferralManager] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('fails closed when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    process.env.SUPABASE_URL = 'https://server.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';

    const { trackReferral } = await importFreshReferralManager();

    await expect(trackReferral('ABC12345', 'new-user@example.com')).rejects.toThrow(
      '[ReferralManager] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});

describe('ReferralManager tracking idempotency', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  function setServerEnv() {
    process.env.SUPABASE_URL = 'https://server.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  }

  it('awards referral credits only after the relationship write returns a row', async () => {
    setServerEnv();
    addCreditsMock.mockResolvedValue({ success: true, creditsRemaining: 25 });
    supabaseMock.from
      .mockReturnValueOnce(mockSelectSingle({
        data: { email: 'referrer@example.com' },
        error: null,
      }))
      .mockReturnValueOnce(mockConditionalReferralUpdate({
        data: { email: 'new-user@example.com' },
        error: null,
      }).table);

    const { trackReferral } = await importFreshReferralManager();

    await expect(trackReferral('REF12345', 'new-user@example.com')).resolves.toEqual({
      success: true,
    });
    expect(addCreditsMock).toHaveBeenCalledTimes(2);
    expect(addCreditsMock).toHaveBeenNthCalledWith(
      1,
      'referrer@example.com',
      5,
      'referral_reward',
      expect.objectContaining({ referee_email: 'new-user@example.com' })
    );
    expect(addCreditsMock).toHaveBeenNthCalledWith(
      2,
      'new-user@example.com',
      5,
      'referral_reward',
      expect.objectContaining({ referrer_email: 'referrer@example.com' })
    );
  });

  it('does not award duplicate credits when the referee already has a referrer', async () => {
    setServerEnv();
    const updateMock = mockConditionalReferralUpdate({
      data: null,
      error: null,
    });
    supabaseMock.from
      .mockReturnValueOnce(mockSelectSingle({
        data: { email: 'referrer@example.com' },
        error: null,
      }))
      .mockReturnValueOnce(updateMock.table)
      .mockReturnValueOnce(mockSelectSingle({
        data: { referred_by_email: 'referrer@example.com' },
        error: null,
      }));

    const { trackReferral } = await importFreshReferralManager();

    await expect(trackReferral('REF12345', 'new-user@example.com')).resolves.toEqual({
      success: false,
      error: 'Already referred by another user',
    });
    expect(updateMock.spies.is).toHaveBeenCalledWith('referred_by_email', null);
    expect(addCreditsMock).not.toHaveBeenCalled();
  });

  it('does not award credits when the referee credit row is missing', async () => {
    setServerEnv();
    supabaseMock.from
      .mockReturnValueOnce(mockSelectSingle({
        data: { email: 'referrer@example.com' },
        error: null,
      }))
      .mockReturnValueOnce(mockConditionalReferralUpdate({
        data: null,
        error: null,
      }).table)
      .mockReturnValueOnce(mockSelectSingle({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      }));

    const { trackReferral } = await importFreshReferralManager();

    await expect(trackReferral('REF12345', 'new-user@example.com')).resolves.toEqual({
      success: false,
      error: 'Referral record not found',
    });
    expect(addCreditsMock).not.toHaveBeenCalled();
  });
});
