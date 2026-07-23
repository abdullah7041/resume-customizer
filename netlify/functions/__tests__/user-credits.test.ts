import type { HandlerEvent, HandlerResponse } from '@netlify/functions';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUserCreditsMock, getUserMock } = vi.hoisted(() => ({
  getUserCreditsMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock('../../lib/rate-limiter.js', () => ({
  withRateLimit: (_name: string, handler: unknown) => handler,
}));

vi.mock('../../lib/supabase-client.js', () => ({
  getSupabaseClient: vi.fn(() => ({ auth: { getUser: getUserMock } })),
}));

vi.mock('../../lib/credit-manager.js', () => ({
  getUserCredits: getUserCreditsMock,
  isEmailVerified: (user: { email_confirmed_at?: string | null } | null) => Boolean(user?.email_confirmed_at),
}));

vi.mock('../../lib/ip-utils.js', () => ({
  getClientIP: vi.fn(() => '203.0.113.5'),
}));

vi.mock('../../lib/sentry.js', () => ({
  initSentry: vi.fn(),
  captureError: vi.fn(),
  summarizeErrorForLog: vi.fn((error: unknown) => (error instanceof Error ? error.message : String(error))),
}));

const { handler } = await import('../user-credits.js');

const invoke = async (
  headers: Record<string, string> = { authorization: 'Bearer token' },
  httpMethod = 'POST',
): Promise<HandlerResponse> => {
  const event = { httpMethod, headers, body: '{}' } as unknown as HandlerEvent;
  return (await handler(event, {} as never)) as HandlerResponse;
};

const parseBody = (response: HandlerResponse) => JSON.parse(response.body ?? '{}');

const verifiedUser = {
  id: 'user-1',
  email: 'user@example.com',
  email_confirmed_at: '2026-07-01T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  getUserMock.mockResolvedValue({ data: { user: verifiedUser }, error: null });
});

describe('user-credits handler', () => {
  it('rejects non-POST requests', async () => {
    const response = await invoke({ authorization: 'Bearer token' }, 'GET');

    expect(response.statusCode).toBe(405);
    expect(getUserCreditsMock).not.toHaveBeenCalled();
  });

  it('requires an Authorization header', async () => {
    const response = await invoke({});

    expect(response.statusCode).toBe(401);
    expect(getUserCreditsMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: 'bad token' } });

    const response = await invoke();

    expect(response.statusCode).toBe(401);
    expect(getUserCreditsMock).not.toHaveBeenCalled();
  });

  it('releases a pending initial grant and returns the granted balance', async () => {
    // getUserCredits performs the grant server-side; the flag is cleared by then.
    getUserCreditsMock.mockResolvedValue({
      credits_remaining: 20,
      credits_total: 20,
      feedback_credits_earned: 0,
      referral_credits_earned: 0,
      last_reset_date: '2026-07-23T00:00:00.000Z',
      signup_metadata: { pending_initial_grant: false },
    });

    const response = await invoke();

    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual({
      creditsRemaining: 20,
      creditsTotal: 20,
      feedbackCreditsEarned: 0,
      referralCreditsEarned: 0,
      lastResetDate: '2026-07-23T00:00:00.000Z',
      pendingInitialGrant: false,
      emailVerified: true,
    });
    expect(getUserCreditsMock).toHaveBeenCalledWith('user@example.com', {
      ipAddress: '203.0.113.5',
      emailVerified: true,
    });
  });

  it('reports a still-pending grant for an unverified email', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { ...verifiedUser, email_confirmed_at: null } },
      error: null,
    });
    getUserCreditsMock.mockResolvedValue({
      credits_remaining: 0,
      credits_total: 0,
      feedback_credits_earned: 0,
      referral_credits_earned: 0,
      last_reset_date: '2026-07-23T00:00:00.000Z',
      signup_metadata: { pending_initial_grant: true },
    });

    const response = await invoke();

    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toMatchObject({
      creditsRemaining: 0,
      pendingInitialGrant: true,
      emailVerified: false,
    });
    expect(getUserCreditsMock).toHaveBeenCalledWith('user@example.com', {
      ipAddress: '203.0.113.5',
      emailVerified: false,
    });
  });

  it('returns a generic 500 without leaking the underlying error', async () => {
    getUserCreditsMock.mockRejectedValue(new Error('connect ECONNREFUSED db.internal:5432'));

    const response = await invoke();

    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toEqual({ error: 'Failed to retrieve credit balance' });
    expect(response.body).not.toContain('ECONNREFUSED');
  });
});
