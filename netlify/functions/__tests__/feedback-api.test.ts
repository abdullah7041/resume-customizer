import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HandlerContext, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { readFileSync } from 'fs';
import { join } from 'path';

const {
  getSupabaseClientMock,
  getUserMock,
  rpcMock,
  fromMock,
} = vi.hoisted(() => {
  const getUser = vi.fn();
  const rpc = vi.fn();
  const from = vi.fn();

  return {
    getSupabaseClientMock: vi.fn(() => ({
      auth: { getUser },
      rpc,
      from,
    })),
    getUserMock: getUser,
    rpcMock: rpc,
    fromMock: from,
  };
});

vi.mock('../../lib/supabase-client.js', () => ({
  getSupabaseClient: getSupabaseClientMock,
}));

vi.mock('../../lib/sentry.js', () => ({
  redactForLog: vi.fn((value: string) => value),
  summarizeErrorForLog: vi.fn((error: unknown) =>
    error instanceof Error ? { name: error.name, message: error.message } : error
  ),
}));

const { handler, hashFeedbackMessage } = await import('../feedback-api.js');

const context = {} as HandlerContext;

function makeEvent(event: Partial<HandlerEvent>): HandlerEvent {
  return {
    httpMethod: 'POST',
    headers: {},
    body: null,
    queryStringParameters: {},
    ...event,
  } as HandlerEvent;
}

function parseBody(response: HandlerResponse) {
  return JSON.parse(response.body || '{}') as Record<string, unknown>;
}

function mockUser(role?: string) {
  getUserMock.mockResolvedValue({
    data: {
      user: {
        id: 'real-user-id',
        email: 'real-user@example.com',
        app_metadata: role ? { role } : {},
      },
    },
    error: null,
  });
}

function validPostBody(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    type: 'bug',
    message: 'The export button gets stuck after I retry a failed PDF download.',
    rating: 4,
    context: {
      pagePath: '/workspace',
      userAgent: 'Vitest Browser',
      viewport: 'desktop 1440x900',
    },
    ...overrides,
  });
}

describe('feedback-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseClientMock.mockReturnValue({
      auth: { getUser: getUserMock },
      rpc: rpcMock,
      from: fromMock,
    });
    mockUser();
    rpcMock.mockResolvedValue({
      data: {
        success: true,
        id: 'feedback-1',
        reward_status: 'awarded',
        credits_awarded: 5,
        credits_remaining: 25,
      },
      error: null,
    });
  });

  it('rejects unauthenticated submissions before opening user input', async () => {
    const response = (await handler(
      makeEvent({ body: validPostBody() }),
      context
    )) as HandlerResponse;

    expect(response.statusCode).toBe(401);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('validates feedback type and minimum message length', async () => {
    const invalidType = (await handler(
      makeEvent({
        headers: { authorization: 'Bearer token' },
        body: validPostBody({ type: 'legacy_smiley' }),
      }),
      context
    )) as HandlerResponse;

    expect(invalidType.statusCode).toBe(400);
    expect(parseBody(invalidType).code).toBe('invalid_feedback_type');

    const shortMessage = (await handler(
      makeEvent({
        headers: { authorization: 'Bearer token' },
        body: validPostBody({ message: 'Too short' }),
      }),
      context
    )) as HandlerResponse;

    expect(shortMessage.statusCode).toBe(400);
    expect(parseBody(shortMessage).code).toBe('message_too_short');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('submits only authenticated identity, safe context, and server-derived reward fields', async () => {
    const response = (await handler(
      makeEvent({
        headers: { authorization: 'Bearer token' },
        body: validPostBody({
          user_id: 'attacker-id',
          userEmail: 'attacker@example.com',
          creditsAwarded: 500,
          rewardStatus: 'awarded',
          context: {
            pagePath: '/admin/feedback',
            userAgent: 'Vitest Browser',
            viewport: 'desktop 1440x900',
            resumeText: 'secret resume',
            jobText: 'secret job',
          },
        }),
      }),
      context
    )) as HandlerResponse;

    expect(response.statusCode).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith('submit_feedback_report', {
      p_user_id: 'real-user-id',
      p_user_email: 'real-user@example.com',
      p_type: 'bug',
      p_message: 'The export button gets stuck after I retry a failed PDF download.',
      p_rating: 4,
      p_page_path: '/admin/feedback',
      p_user_agent: 'Vitest Browser',
      p_viewport: 'desktop 1440x900',
      p_message_hash: hashFeedbackMessage(
        'The export button gets stuck after I retry a failed PDF download.'
      ),
    });

    const rpcPayload = rpcMock.mock.calls[0][1];
    expect(JSON.stringify(rpcPayload)).not.toContain('secret resume');
    expect(JSON.stringify(rpcPayload)).not.toContain('secret job');
    expect(JSON.stringify(rpcPayload)).not.toContain('attacker');
    expect(JSON.stringify(rpcPayload)).not.toContain('500');
  });

  it('rejects duplicate same-user feedback messages without awarding credits', async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        success: false,
        error: 'duplicate_feedback',
        reward_status: 'duplicate',
        credits_awarded: 0,
      },
      error: null,
    });

    const response = (await handler(
      makeEvent({
        headers: { authorization: 'Bearer token' },
        body: validPostBody(),
      }),
      context
    )) as HandlerResponse;

    expect(response.statusCode).toBe(409);
    expect(parseBody(response).code).toBe('duplicate_feedback');
  });

  it('returns first eligible +5 reward metadata from the service-role RPC', async () => {
    const response = (await handler(
      makeEvent({
        headers: { authorization: 'Bearer token' },
        body: validPostBody(),
      }),
      context
    )) as HandlerResponse;

    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toMatchObject({
      success: true,
      rewardStatus: 'awarded',
      creditsAwarded: 5,
      creditsRemaining: 25,
    });
  });

  it('does not award unauthenticated users', async () => {
    const response = (await handler(
      makeEvent({
        body: validPostBody(),
      }),
      context
    )) as HandlerResponse;

    expect(response.statusCode).toBe(401);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('blocks non-admin GET and PATCH requests after server-side token verification', async () => {
    const getResponse = (await handler(
      makeEvent({
        httpMethod: 'GET',
        headers: { authorization: 'Bearer token' },
      }),
      context
    )) as HandlerResponse;

    expect(getResponse.statusCode).toBe(403);

    const patchResponse = (await handler(
      makeEvent({
        httpMethod: 'PATCH',
        headers: { authorization: 'Bearer token' },
        body: JSON.stringify({ id: 'feedback-1', status: 'reviewing' }),
      }),
      context
    )) as HandlerResponse;

    expect(patchResponse.statusCode).toBe(403);
    expect(getUserMock).toHaveBeenCalledWith('token');
  });

  it('allows admin GET and PATCH only after server-side token verification', async () => {
    mockUser('admin');
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [{ id: 'feedback-1', message: 'Report' }],
            error: null,
          }),
        }),
      }),
    });

    const getResponse = (await handler(
      makeEvent({
        httpMethod: 'GET',
        headers: { authorization: 'Bearer token' },
      }),
      context
    )) as HandlerResponse;

    expect(getResponse.statusCode).toBe(200);
    expect(parseBody(getResponse).reports).toEqual([{ id: 'feedback-1', message: 'Report' }]);

    const updateBuilder = {
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'feedback-1',
                status: 'reviewing',
                priority: 'high',
                admin_notes: 'Triaged',
              },
              error: null,
            }),
          }),
        }),
      }),
    };
    fromMock.mockReturnValueOnce(updateBuilder);

    const patchResponse = (await handler(
      makeEvent({
        httpMethod: 'PATCH',
        headers: { authorization: 'Bearer token' },
        body: JSON.stringify({
          id: 'feedback-1',
          status: 'reviewing',
          priority: 'high',
          adminNotes: 'Triaged',
        }),
      }),
      context
    )) as HandlerResponse;

    expect(patchResponse.statusCode).toBe(200);
    expect(updateBuilder.update).toHaveBeenCalledWith({
      status: 'reviewing',
      priority: 'high',
      admin_notes: 'Triaged',
    });
    expect(getUserMock).toHaveBeenCalledWith('token');
  });

  it('ships a locked service-role-only SQL reward function that writes the credit ledger', () => {
    const migrationSql = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260601192000_create_feedback_reports.sql'),
      'utf8'
    ).toLowerCase();

    expect(migrationSql).toContain('security definer');
    expect(migrationSql).toContain('set search_path = public, pg_temp');
    expect(migrationSql).toContain('revoke execute on function public.submit_feedback_report');
    expect(migrationSql).toContain('from public, anon, authenticated');
    expect(migrationSql).toContain('grant execute on function public.submit_feedback_report');
    expect(migrationSql).toContain('to service_role');
    expect(migrationSql).toContain('insert into public.credit_transactions');
    expect(migrationSql).toContain("'feedback_reward'");
    expect(migrationSql).toContain('credits_remaining = v_credits_after');
  });
});
