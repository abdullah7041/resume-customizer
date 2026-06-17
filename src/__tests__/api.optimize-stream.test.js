import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.hoisted(() => vi.fn());
const recordFailureMock = vi.hoisted(() => vi.fn());
const recordSuccessMock = vi.hoisted(() => vi.fn());

vi.mock('../services/supabase.js', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
  },
}));

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));

vi.mock('../lib/utils/circuit-breaker', () => ({
  isCircuitOpen: vi.fn(() => false),
  recordFailure: recordFailureMock,
  recordSuccess: recordSuccessMock,
}));

vi.mock('../lib/utils/resumeText', () => ({
  extractPlainTextFromArrayBuffer: vi.fn(),
  inferMimeType: vi.fn(),
}));

const { optimizeResumeStream } = await import('../services/api.js');

const sseResponse = (bodyText) =>
  new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(bodyText));
        controller.close();
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }
  );

describe('optimizeResumeStream billing-state errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null,
    });
  });

  it('preserves known-safe billing state from server SSE errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse('event: error\ndata: {"error":"Failed to optimize resume","retryable":true}\n\n')
      )
    );

    await expect(
      optimizeResumeStream({
        resumeText: 'Resume text with enough detail',
        jobDesc: 'Job description with enough detail',
      })
    ).rejects.toMatchObject({
      message: 'Failed to optimize resume',
      retryable: true,
      isBillingStateUnknown: false,
    });
  });
});
