import type { HandlerEvent, HandlerResponse } from '@netlify/functions';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeAiContractMock, getUserMock } = vi.hoisted(() => ({
  executeAiContractMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock('../../lib/rate-limiter.js', () => ({
  withRateLimit: (_name: string, handler: unknown) => handler,
}));

vi.mock('../../lib/supabase-client.js', () => ({
  getSupabaseClient: vi.fn(() => ({ auth: { getUser: getUserMock } })),
}));

vi.mock('../../lib/ai-contracts/executor.js', () => ({
  executeAiContract: executeAiContractMock,
}));

vi.mock('../../lib/sentry.js', () => ({
  initSentry: vi.fn(),
  captureError: vi.fn(),
  summarizeErrorForLog: vi.fn((error: unknown) => (error instanceof Error ? error.message : String(error))),
}));

const { handler } = await import('../refine-bullet.js');

const validBody = {
  original: 'Led a team.',
  currentImproved: 'Led a cross-functional team.',
  userInstruction: 'Make the impact clearer.',
  resumeText: 'Led a team that shipped a customer portal.',
};

const invoke = async (
  body: unknown,
  headers: Record<string, string> = { authorization: 'Bearer token' },
  httpMethod = 'POST',
): Promise<HandlerResponse> => {
  const event = { httpMethod, headers, body: JSON.stringify(body) } as unknown as HandlerEvent;
  return (await handler(event, {} as never)) as HandlerResponse;
};

const parseBody = (response: HandlerResponse) => JSON.parse(response.body ?? '{}');

beforeEach(() => {
  vi.clearAllMocks();
  getUserMock.mockResolvedValue({ data: { user: { id: 'user-1', email: 'user@example.com' } }, error: null });
});

describe('refine-bullet handler', () => {
  it('rejects non-POST requests with the structured method envelope', async () => {
    const response = await invoke(validBody, {}, 'GET');

    expect(response.statusCode).toBe(405);
    expect(parseBody(response)).toEqual({
      status: 405,
      code: 'method/not-allowed',
      message: 'Method Not Allowed',
      error: 'Method Not Allowed',
    });
  });

  it('requires an Authorization header', async () => {
    const response = await invoke(validBody, {});

    expect(response.statusCode).toBe(401);
    expect(parseBody(response)).toMatchObject({ status: 401, code: 'auth/required' });
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid authenticated session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } });

    const response = await invoke(validBody);

    expect(response.statusCode).toBe(401);
    expect(parseBody(response)).toMatchObject({ status: 401, code: 'auth/invalid' });
  });

  it('rejects invalid input before calling the AI contract', async () => {
    const { resumeText: _resumeText, ...invalidBody } = validBody;

    const response = await invoke(invalidBody);

    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toMatchObject({ status: 400, code: 'request/invalid' });
    expect(executeAiContractMock).not.toHaveBeenCalled();
  });

  it('returns the refined bullet contract and passes normalized defaults', async () => {
    executeAiContractMock.mockResolvedValue({
      improved: 'Led a cross-functional team to ship a customer portal.',
      issue: 'Impact was unclear.',
      rationale: 'Adds delivery context without inventing a metric.',
    });

    const response = await invoke(validBody);

    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual({
      improved: 'Led a cross-functional team to ship a customer portal.',
      issue: 'Impact was unclear.',
      rationale: 'Adds delivery context without inventing a metric.',
    });
    expect(executeAiContractMock).toHaveBeenCalledWith('refine_bullet', {
      ...validBody,
      jobContext: '',
      language: 'en',
    });
  });

  it('maps AI failures to the current 500 and 504 envelopes', async () => {
    executeAiContractMock.mockRejectedValueOnce(new Error('provider failed'));

    const failedResponse = await invoke(validBody);
    expect(failedResponse.statusCode).toBe(500);
    expect(parseBody(failedResponse)).toMatchObject({ status: 500, code: 'refine/failed' });

    executeAiContractMock.mockRejectedValueOnce(Object.assign(new Error('provider timed out'), { status: 504 }));

    const timeoutResponse = await invoke(validBody);
    expect(timeoutResponse.statusCode).toBe(504);
    expect(parseBody(timeoutResponse)).toMatchObject({ status: 504, code: 'refine/failed' });
  });
});
