import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HandlerContext, HandlerEvent, HandlerResponse } from '@netlify/functions';

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

  it('uses authenticated email for referral link generation', async () => {
    supabaseFromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
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
          single: vi.fn().mockResolvedValue({
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
});
