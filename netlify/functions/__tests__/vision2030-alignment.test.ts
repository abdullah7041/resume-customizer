import type { HandlerEvent, HandlerResponse } from '@netlify/functions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  captureErrorMock,
  checkCreditsMock,
  consumeCreditsMock,
  createClientMock,
  executeAiContractMock,
  getUserMock,
  isEmailVerifiedMock,
} = vi.hoisted(() => ({
  captureErrorMock: vi.fn(),
  checkCreditsMock: vi.fn(),
  consumeCreditsMock: vi.fn(),
  createClientMock: vi.fn(),
  executeAiContractMock: vi.fn(),
  getUserMock: vi.fn(),
  isEmailVerifiedMock: vi.fn(),
}));

vi.mock('../../lib/rate-limiter.js', () => ({
  withRateLimit: (_name: string, handler: unknown) => handler,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('../../lib/ai-contracts/executor.js', () => ({
  executeAiContract: executeAiContractMock,
}));

vi.mock('../../lib/credit-manager.js', () => ({
  checkCredits: checkCreditsMock,
  consumeCredits: consumeCreditsMock,
  isEmailVerified: isEmailVerifiedMock,
}));

vi.mock('../../lib/ip-utils.js', () => ({
  getClientIP: vi.fn(() => '203.0.113.5'),
}));

vi.mock('../../lib/sentry.js', () => ({
  initSentry: vi.fn(),
  captureError: captureErrorMock,
  summarizeErrorForLog: vi.fn((error: unknown) => (error instanceof Error ? error.message : String(error))),
}));

const { handler } = await import('../vision2030-alignment.js');

const validBody = {
  resumeText: 'Led a digital-skills program serving regional employers.',
  language: 'en',
  jobDescription: 'Seeking a leader for workforce transformation.',
};

const analysis = {
  overallScore: 78,
  summary: 'Strong alignment with human-capability development.',
  pillars: [],
  recommendations: [],
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
  vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
  createClientMock.mockReturnValue({ auth: { getUser: getUserMock } });
  getUserMock.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'user@example.com', email_confirmed_at: '2026-07-21T00:00:00.000Z' } },
    error: null,
  });
  isEmailVerifiedMock.mockReturnValue(true);
  checkCreditsMock.mockResolvedValue({ hasCredits: true, required: 2, available: 10 });
  consumeCreditsMock.mockResolvedValue({ success: true, creditsRemaining: 8 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('vision2030-alignment handler', () => {
  it('rejects non-POST requests with the current bare-string body', async () => {
    const response = await invoke(validBody, {}, 'GET');

    expect(response.statusCode).toBe(405);
    expect(response.body).toBe('Method Not Allowed');
  });

  it('requires an Authorization header', async () => {
    const response = await invoke(validBody, {});

    expect(response.statusCode).toBe(401);
    expect(parseBody(response)).toEqual({ error: 'Authentication required. Please sign in.' });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid authenticated session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } });

    const response = await invoke(validBody);

    expect(response.statusCode).toBe(401);
    expect(parseBody(response)).toEqual({ error: 'Invalid or expired authentication token' });
    expect(checkCreditsMock).not.toHaveBeenCalled();
  });

  it('rejects invalid input before AI execution or credit consumption', async () => {
    const response = await invoke({ resumeText: '' });

    expect(response.statusCode).toBe(400);
    expect(parseBody(response).error).toEqual(expect.any(String));
    expect(executeAiContractMock).not.toHaveBeenCalled();
    expect(consumeCreditsMock).not.toHaveBeenCalled();
  });

  it('returns the AI analysis with the post-consumption credit balance', async () => {
    executeAiContractMock.mockResolvedValue(analysis);

    const response = await invoke(validBody);

    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual({ ...analysis, creditsRemaining: 8 });
    expect(checkCreditsMock).toHaveBeenCalledWith(
      'user@example.com',
      'vision2030',
      { ipAddress: '203.0.113.5', emailVerified: true },
    );
    expect(executeAiContractMock).toHaveBeenCalledWith('vision2030_alignment', validBody);
    expect(consumeCreditsMock).toHaveBeenCalledWith('user@example.com', 'vision2030');
  });

  it('maps AI rejection and timeout without consuming credits', async () => {
    executeAiContractMock.mockRejectedValueOnce(new Error('provider failed'));

    const failedResponse = await invoke(validBody);
    expect(failedResponse.statusCode).toBe(500);
    expect(parseBody(failedResponse)).toEqual({
      error: 'Failed to analyze Vision 2030 alignment',
      retryable: false,
    });
    expect(consumeCreditsMock).not.toHaveBeenCalled();
    expect(captureErrorMock).toHaveBeenCalledTimes(1);

    captureErrorMock.mockClear();
    const timeoutError = Object.assign(new Error('provider timed out'), { name: 'TimeoutError', status: 504 });
    executeAiContractMock.mockRejectedValueOnce(timeoutError);

    const timeoutResponse = await invoke(validBody);
    expect(timeoutResponse.statusCode).toBe(504);
    expect(timeoutResponse.headers).toMatchObject({
      'Retry-After': '30',
      'X-Timeout-Location': 'openrouter-api',
    });
    expect(parseBody(timeoutResponse).retryable).toBe(true);
    expect(consumeCreditsMock).not.toHaveBeenCalled();
    expect(captureErrorMock).not.toHaveBeenCalled();
  });

  it('pins the current 200 response when credit consumption reports failure', async () => {
    executeAiContractMock.mockResolvedValue(analysis);
    consumeCreditsMock.mockResolvedValue({ success: false, creditsRemaining: 0 });

    const response = await invoke(validBody);

    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual({ ...analysis, creditsRemaining: 0 });
  });
});
