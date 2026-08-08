import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HandlerContext, HandlerEvent, HandlerResponse } from '@netlify/functions';

// Force the rate limiter's fail-open "not configured" path instead of real
// network calls to the fake test.upstash.io host used elsewhere in the suite.
const originalEnv = { ...process.env };
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const {
  getReferralStatsMock,
  getSupabaseClientMock,
  getUserMock,
  supabaseFromMock,
  trackReferralMock,
} = vi.hoisted(() => {
  const getUser = vi.fn();
  const from = vi.fn();

  return {
    getReferralStatsMock: vi.fn(),
    getSupabaseClientMock: vi.fn(() => ({
      auth: { getUser },
      from,
    })),
    getUserMock: getUser,
    supabaseFromMock: from,
    trackReferralMock: vi.fn(),
  };
});

vi.mock('../../lib/supabase-client.js', () => ({
  getSupabaseClient: getSupabaseClientMock,
}));

vi.mock('../../lib/referral-manager.js', () => ({
  getReferralStats: getReferralStatsMock,
  trackReferral: trackReferralMock,
}));

vi.mock('nanoid', () => ({
  customAlphabet: vi.fn(() => vi.fn(() => 'TESTCODE')),
}));

const { handler } = await import('../referral-api.js');

const context = {} as HandlerContext;
const sensitiveManagerError = 'connection to referral-db.internal failed with sk_1234567890abcdef';

function makeEvent(event: Partial<HandlerEvent>): HandlerEvent {
  return {
    httpMethod: 'GET',
    headers: {},
    body: null,
    queryStringParameters: {},
    ...event,
  } as HandlerEvent;
}

describe('referral-api auth binding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseClientMock.mockReturnValue({
      auth: { getUser: getUserMock },
      from: supabaseFromMock,
    });
    getUserMock.mockResolvedValue({
      data: { user: { id: 'real-user-id', email: 'real-user@example.com' } },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it('requires authentication for referral stats', async () => {
    const response = await handler(
      makeEvent({
        httpMethod: 'GET',
        queryStringParameters: { action: 'get-stats' },
      }),
      context
    ) as HandlerResponse;

    expect(response.statusCode).toBe(401);
    expect(getReferralStatsMock).not.toHaveBeenCalled();
  });

  it('routes requests through the rate limiter', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    getReferralStatsMock.mockResolvedValue({
      total: 0,
      completed: 0,
      pending: 0,
      creditsEarned: 0,
    });

    const response = await handler(
      makeEvent({
        httpMethod: 'GET',
        headers: { Authorization: 'Bearer token' },
        queryStringParameters: { action: 'get-stats' },
      }),
      context
    ) as HandlerResponse;

    expect(response.statusCode).toBe(200);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Upstash not configured — allowing request to referral-api')
    );
  });

  it('uses authenticated user id for stats instead of query email', async () => {
    getReferralStatsMock.mockResolvedValue({
      total: 2,
      completed: 1,
      pending: 1,
      creditsEarned: 5,
    });

    const response = await handler(
      makeEvent({
        httpMethod: 'GET',
        headers: { Authorization: 'Bearer token' },
        queryStringParameters: {
          action: 'get-stats',
          email: 'attacker@example.com',
        },
      }),
      context
    ) as HandlerResponse;

    expect(response.statusCode).toBe(200);
    expect(getReferralStatsMock).toHaveBeenCalledWith('real-user-id');
  });

  it('uses authenticated identity as the referee when tracking referrals', async () => {
    trackReferralMock.mockResolvedValue({ success: true });

    const response = await handler(
      makeEvent({
        httpMethod: 'POST',
        headers: { Authorization: 'Bearer token' },
        body: JSON.stringify({
          action: 'track',
          referral_code: 'REF12345',
          referee_email: 'attacker@example.com',
          referee_id: 'attacker-id',
        }),
      }),
      context
    ) as HandlerResponse;

    expect(response.statusCode).toBe(200);
    expect(trackReferralMock).toHaveBeenCalledWith('REF12345', 'real-user@example.com', 'real-user-id');
  });

  it('returns a generic coded track failure while retaining sanitized diagnostics in server logs', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    trackReferralMock.mockResolvedValue({ success: false, error: sensitiveManagerError });

    const response = await handler(
      makeEvent({
        httpMethod: 'POST',
        headers: { Authorization: 'Bearer token' },
        body: JSON.stringify({ action: 'track', referral_code: 'REF12345' }),
      }),
      context
    ) as HandlerResponse;

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body!)).toEqual({
      status: 400,
      code: 'referral/track-failed',
      message: 'Failed to track referral',
      error: 'Failed to track referral',
    });
    expect(response.body).not.toContain(sensitiveManagerError);
    expect(response.body).not.toContain('referral-db.internal');

    const logOutput = JSON.stringify(consoleError.mock.calls);
    expect(logOutput).toContain('referral-db.internal');
    expect(logOutput).toContain('[REDACTED]');
    expect(logOutput).not.toContain('sk_1234567890abcdef');
  });

  it('returns a stable generic envelope for unexpected failures', async () => {
    const response = await handler(
      makeEvent({
        httpMethod: 'POST',
        body: '{"action":',
      }),
      context
    ) as HandlerResponse;

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body!)).toEqual({
      error: 'Referral operation failed',
      code: 'referral/unexpected',
    });
    expect(response.body).not.toContain('Unexpected end of JSON input');
  });

  it('uses authenticated email for referral link generation', async () => {
    supabaseFromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { referral_code: 'REALCODE' },
            error: null,
          }),
        }),
      }),
    });

    const response = await handler(
      makeEvent({
        httpMethod: 'GET',
        headers: { Authorization: 'Bearer token' },
        queryStringParameters: {
          action: 'get-link',
          email: 'attacker@example.com',
        },
      }),
      context
    ) as HandlerResponse;

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('REALCODE');
    const fromResult = supabaseFromMock.mock.results[0].value;
    const selectResult = fromResult.select.mock.results[0].value;
    const eqMock = selectResult.eq;
    expect(eqMock).toHaveBeenCalledWith('email', 'real-user@example.com');
  });

  it('returns referral summary with one token verification', async () => {
    getReferralStatsMock.mockResolvedValue({
      total: 3,
      completed: 2,
      pending: 1,
      creditsEarned: 10,
    });
    supabaseFromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { referral_code: 'REALCODE' },
            error: null,
          }),
        }),
      }),
    });

    const response = await handler(
      makeEvent({
        httpMethod: 'GET',
        headers: { Authorization: 'Bearer token' },
        queryStringParameters: {
          action: 'get-summary',
        },
      }),
      context
    ) as HandlerResponse;

    expect(response.statusCode).toBe(200);
    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(response.body).toContain('REALCODE');
    expect(response.body).toContain('"creditsEarned":10');
  });

  it('returns stats with a generic coded linkError instead of database details', async () => {
    getReferralStatsMock.mockResolvedValue({
      total: 3,
      completed: 2,
      pending: 1,
      creditsEarned: 10,
    });
    // Simulate the referral migrations missing in production: Postgres 42703
    supabaseFromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { code: '42703', message: 'column user_credits.referral_code does not exist' },
          }),
        }),
      }),
    });

    const response = await handler(
      makeEvent({
        httpMethod: 'GET',
        headers: { Authorization: 'Bearer token' },
        queryStringParameters: { action: 'get-summary' },
      }),
      context
    ) as HandlerResponse;

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.creditsEarned).toBe(10);
    expect(body.referralUrl).toBeUndefined();
    expect(body.linkError).toBe('Referral data unavailable');
    expect(body.linkErrorCode).toBe('referral/db-undefined-column');
    expect(body.linkErrorStatus).toBe(500);
    expect(response.body).not.toContain('42703');
    expect(response.body).not.toContain('20260713000000_ensure_referral_schema.sql');
    expect(response.body).not.toContain('column user_credits.referral_code does not exist');
  });

  it('returns a generic coded envelope when referral columns are unavailable', async () => {
    supabaseFromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { code: '42703', message: 'column user_credits.referral_code does not exist' },
          }),
        }),
      }),
    });

    const response = await handler(
      makeEvent({
        httpMethod: 'GET',
        headers: { Authorization: 'Bearer token' },
        queryStringParameters: { action: 'get-link' },
      }),
      context
    ) as HandlerResponse;

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body!)).toEqual({
      error: 'Failed to generate referral link',
      status: 500,
      code: 'referral/db-undefined-column',
      message: 'Referral data unavailable',
      details: 'Referral data unavailable',
    });
    expect(response.body).not.toContain('42703');
    expect(response.body).not.toContain('20260713000000_ensure_referral_schema.sql');
  });

  it('keeps failed stats distinguishable from a genuine zero-referral summary', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getReferralStatsMock.mockRejectedValue(new Error(sensitiveManagerError));
    supabaseFromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { referral_code: 'REALCODE' },
            error: null,
          }),
        }),
      }),
    });

    const response = await handler(
      makeEvent({
        httpMethod: 'GET',
        headers: { Authorization: 'Bearer token' },
        queryStringParameters: { action: 'get-summary' },
      }),
      context
    ) as HandlerResponse;

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body!)).toMatchObject({
      success: true,
      referralCode: 'REALCODE',
      statsError: 'Failed to load referral statistics',
      statsErrorCode: 'referral/stats-failed',
      statsErrorStatus: 500,
    });
    expect(response.body).not.toContain(sensitiveManagerError);
    expect(response.body).not.toContain('referral-db.internal');
    expect(response.body).not.toContain('"totalReferrals":0');

    const logOutput = JSON.stringify(consoleError.mock.calls);
    expect(logOutput).toContain('referral-db.internal');
    expect(logOutput).toContain('[REDACTED]');
    expect(logOutput).not.toContain('sk_1234567890abcdef');
  });

  it('does not hand out a referral code that could not be persisted', async () => {
    supabaseFromMock.mockReturnValue({
      // No existing code on file…
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      // …and the update matches no user_credits row (row not initialized yet).
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    });

    const response = await handler(
      makeEvent({
        httpMethod: 'GET',
        headers: { Authorization: 'Bearer token' },
        queryStringParameters: { action: 'get-link' },
      }),
      context
    ) as HandlerResponse;

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body!);
    expect(body.details).toContain('Referral profile not found');
    expect(body).toMatchObject({
      status: 500,
      code: 'referral/profile-not-found',
      message: expect.stringContaining('Referral profile not found'),
    });
  });

  it('returns a concurrently saved code when the guarded save loses the race', async () => {
    const guardedUpdateIsMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
    const guardedUpdate = {
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: guardedUpdateIsMock,
        }),
      }),
    };
    supabaseFromMock
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      })
      .mockReturnValueOnce(guardedUpdate)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { referral_code: 'CONCURRENTCODE' },
              error: null,
            }),
          }),
        }),
      });

    const response = await handler(
      makeEvent({
        httpMethod: 'GET',
        headers: { Authorization: 'Bearer token' },
        queryStringParameters: { action: 'get-link' },
      }),
      context
    ) as HandlerResponse;

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('CONCURRENTCODE');
    expect(guardedUpdateIsMock).toHaveBeenCalledWith('referral_code', null);
  });
});
