import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  addCreditsMock,
  sendReferralRewardRefereeMock,
  sendReferralRewardReferrerMock,
  supabaseMock,
} = vi.hoisted(() => ({
  addCreditsMock: vi.fn(),
  sendReferralRewardRefereeMock: vi.fn(),
  sendReferralRewardReferrerMock: vi.fn(),
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

vi.mock('../email-service.js', () => ({
  sendReferralRewardReferee: sendReferralRewardRefereeMock,
  sendReferralRewardReferrer: sendReferralRewardReferrerMock,
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
  const query = {
    is: vi.fn(() => query),
    select: vi.fn(() => ({ maybeSingle })),
  };
  const eq = vi.fn(() => query);
  const update = vi.fn(() => ({ eq }));

  return {
    table: { update },
    spies: { update, eq, is: query.is, select: query.select, maybeSingle },
  };
}

function mockUpdateEq(result) {
  return {
    update: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue(result),
    })),
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
    sendReferralRewardRefereeMock.mockResolvedValue({ success: true });
    sendReferralRewardReferrerMock.mockResolvedValue({ success: true });
  }

  it('awards referral credits only after the relationship write returns a row', async () => {
    setServerEnv();
    addCreditsMock.mockResolvedValue({ success: true, creditsRemaining: 25 });
    const updateMock = mockConditionalReferralUpdate({
      data: { email: 'new-user@example.com' },
      error: null,
    });
    supabaseMock.from
      .mockReturnValueOnce(mockSelectSingle({
        data: { email: 'referrer@example.com', user_id: 'referrer-user-id' },
        error: null,
      }))
      .mockReturnValueOnce(updateMock.table);

    const { trackReferral } = await importFreshReferralManager();

    await expect(trackReferral('REF12345', 'new-user@example.com', 'new-user-id')).resolves.toEqual({
      success: true,
    });
    expect(updateMock.spies.update).toHaveBeenCalledWith(expect.objectContaining({
      referred_by_user_id: 'referrer-user-id',
    }));
    expect(updateMock.spies.eq).toHaveBeenCalledWith('user_id', 'new-user-id');
    expect(updateMock.spies.is).toHaveBeenCalledWith('referred_by_user_id', null);
    expect(addCreditsMock).toHaveBeenCalledTimes(2);
    expect(addCreditsMock).toHaveBeenNthCalledWith(
      1,
      'referrer@example.com',
      5,
      'referral_reward',
      expect.objectContaining({
        description: 'Referral bonus: new user signed up',
        referee_user_id: 'new-user-id',
      })
    );
    expect(addCreditsMock).toHaveBeenNthCalledWith(
      2,
      'new-user@example.com',
      5,
      'referral_reward',
      expect.objectContaining({
        description: 'Referral bonus: welcome reward',
        referrer_user_id: 'referrer-user-id',
      })
    );
    expect(addCreditsMock.mock.calls[0][3]).not.toHaveProperty('referee_email');
    expect(addCreditsMock.mock.calls[1][3]).not.toHaveProperty('referrer_email');
    expect(sendReferralRewardReferrerMock).toHaveBeenCalledWith(
      'referrer@example.com',
      'Watheq user',
      'a Watheq user',
      'en'
    );
    expect(sendReferralRewardRefereeMock).toHaveBeenCalledWith(
      'new-user@example.com',
      'Watheq user',
      'a Watheq user',
      'en'
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
        data: { email: 'referrer@example.com', user_id: 'referrer-user-id' },
        error: null,
      }))
      .mockReturnValueOnce(updateMock.table)
      .mockReturnValueOnce(mockSelectSingle({
        data: { referred_by_user_id: 'referrer-user-id' },
        error: null,
      }));

    const { trackReferral } = await importFreshReferralManager();

    await expect(trackReferral('REF12345', 'new-user@example.com', 'new-user-id')).resolves.toEqual({
      success: false,
      error: 'Already referred by another user',
    });
    expect(updateMock.spies.is).toHaveBeenCalledWith('referred_by_user_id', null);
    expect(addCreditsMock).not.toHaveBeenCalled();
    expect(sendReferralRewardReferrerMock).not.toHaveBeenCalled();
    expect(sendReferralRewardRefereeMock).not.toHaveBeenCalled();
  });

  it('does not award duplicate credits for legacy email-keyed referrals', async () => {
    setServerEnv();
    const updateMock = mockConditionalReferralUpdate({
      data: null,
      error: null,
    });
    supabaseMock.from
      .mockReturnValueOnce(mockSelectSingle({
        data: { email: 'referrer@example.com', user_id: 'referrer-user-id' },
        error: null,
      }))
      .mockReturnValueOnce(updateMock.table)
      .mockReturnValueOnce(mockSelectSingle({
        data: { referred_by_user_id: null, referred_by_email: 'legacy-referrer@example.com' },
        error: null,
      }));

    const { trackReferral } = await importFreshReferralManager();

    await expect(trackReferral('REF12345', 'new-user@example.com', 'new-user-id')).resolves.toEqual({
      success: false,
      error: 'Already referred by another user',
    });
    expect(updateMock.spies.is).toHaveBeenCalledWith('referred_by_user_id', null);
    expect(updateMock.spies.is).toHaveBeenCalledWith('referred_by_email', null);
    expect(addCreditsMock).not.toHaveBeenCalled();
    expect(sendReferralRewardReferrerMock).not.toHaveBeenCalled();
    expect(sendReferralRewardRefereeMock).not.toHaveBeenCalled();
  });

  it('does not award credits when the referee credit row is missing', async () => {
    setServerEnv();
    supabaseMock.from
      .mockReturnValueOnce(mockSelectSingle({
        data: { email: 'referrer@example.com', user_id: 'referrer-user-id' },
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

    await expect(trackReferral('REF12345', 'new-user@example.com', 'new-user-id')).resolves.toEqual({
      success: false,
      error: 'Referral record not found',
    });
    expect(addCreditsMock).not.toHaveBeenCalled();
    expect(sendReferralRewardReferrerMock).not.toHaveBeenCalled();
    expect(sendReferralRewardRefereeMock).not.toHaveBeenCalled();
  });

  it('completes existing UUID referrals by resolving the referrer email from user_id', async () => {
    setServerEnv();
    supabaseMock.rpc.mockResolvedValue({ error: null });
    supabaseMock.from
      .mockReturnValueOnce(mockSelectSingle({
        data: { referred_by_user_id: 'referrer-user-id', referral_completed: false },
        error: null,
      }))
      .mockReturnValueOnce(mockSelectSingle({
        data: { email: 'referrer@example.com' },
        error: null,
      }))
      .mockReturnValueOnce(mockUpdateEq({ error: null }));

    const { completeReferral } = await importFreshReferralManager();

    await expect(completeReferral('new-user@example.com')).resolves.toEqual({
      completed: true,
      referrerReward: 5,
      refereeReward: 5,
    });
    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(1, 'add_credits', expect.objectContaining({
      p_email: 'referrer@example.com',
      p_transaction_type: 'referral_reward',
    }));
    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(2, 'add_credits', expect.objectContaining({
      p_email: 'new-user@example.com',
      p_transaction_type: 'referral_reward',
    }));
  });
});
