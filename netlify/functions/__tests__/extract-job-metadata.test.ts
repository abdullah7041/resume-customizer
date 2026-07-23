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

const { handler } = await import('../extract-job-metadata.js');

const validBody = {
  jobText: 'Acme is hiring a Senior Platform Engineer in Riyadh.',
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

describe('extract-job-metadata handler', () => {
  it('rejects non-POST requests with the current bare-string body', async () => {
    const response = await invoke(validBody, {}, 'GET');

    expect(response.statusCode).toBe(405);
    expect(response.body).toBe('Method Not Allowed');
  });

  it('requires an Authorization header', async () => {
    const response = await invoke(validBody, {});

    expect(response.statusCode).toBe(401);
    expect(parseBody(response)).toEqual({ error: 'Authentication required. Please sign in.' });
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid authenticated session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } });

    const response = await invoke(validBody);

    expect(response.statusCode).toBe(401);
    expect(parseBody(response)).toEqual({ error: 'Invalid or expired authentication token' });
  });

  it('rejects invalid input before calling the AI contract', async () => {
    const response = await invoke({ jobText: 'short' });

    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: 'Invalid request: jobText is required (10-30000 chars)' });
    expect(executeAiContractMock).not.toHaveBeenCalled();
  });

  it('returns conservative metadata based on the confidence thresholds', async () => {
    executeAiContractMock.mockResolvedValue({
      companyName: 'Acme',
      jobTitle: 'Senior Platform Engineer',
      location: 'Riyadh',
      employmentType: 'Full-time',
      seniority: 'Senior',
      sector: 'Technology',
      confidence: { companyName: 0.59, jobTitle: 0.79, location: 0.5 },
      needsUserConfirmation: false,
    });

    const response = await invoke(validBody);

    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual({
      companyName: null,
      jobTitle: 'Senior Platform Engineer',
      location: 'Riyadh',
      employmentType: 'Full-time',
      seniority: 'Senior',
      sector: 'Technology',
      confidence: { companyName: 0.59, jobTitle: 0.79, location: 0.5 },
      needsUserConfirmation: true,
    });
    expect(executeAiContractMock).toHaveBeenCalledWith('job_metadata_extraction', {
      ...validBody,
      language: 'en',
    });
  });

  it('returns the current safe fallback when AI extraction rejects', async () => {
    executeAiContractMock.mockRejectedValue(new Error('provider failed'));

    const response = await invoke(validBody);

    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toEqual({
      error: 'Failed to extract job metadata. You can still save the job manually.',
      companyName: null,
      jobTitle: null,
      location: null,
      employmentType: null,
      seniority: null,
      sector: null,
      confidence: { companyName: 0, jobTitle: 0, location: 0 },
      needsUserConfirmation: true,
    });
  });
});
