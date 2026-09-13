import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const interruptedStreamResponse = () =>
  new Response(
    new ReadableStream({
      pull(controller) {
        controller.error(new Error('network interrupted'));
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }
  );

describe('optimizeResumeStream billing-state errors', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null,
    });
  });

  it('preserves known-safe billing state when server SSE errors omit the billing flag', async () => {
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

  it('marks server SSE errors as billing-state unknown when the server says credits may be consumed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse('event: error\ndata: {"error":"Failed to optimize resume","retryable":true,"billingStateUnknown":true}\n\n')
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
      isBillingStateUnknown: true,
    });
  });

  it('recovers an interrupted paid stream from the no-charge cache path', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(interruptedStreamResponse())
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          cards: [{
            section: 'General',
            issue: 'Cached issue',
            suggestion: 'Cached suggestion',
            exampleBefore: 'Before',
            exampleAfter: 'After',
          }],
          source: 'gemini',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      ));
    vi.stubGlobal('fetch', fetchMock);

    const result = await optimizeResumeStream({
      resumeText: 'Resume text with enough detail',
      jobDesc: 'Job description with enough detail',
      userHardStops: ['Power BI'],
    });

    expect(result.cards).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      resumeText: 'Resume text with enough detail',
      jobText: 'Job description with enough detail',
      userHardStops: ['Power BI'],
      cacheOnly: true,
    });
  });

  it('recovers a gracefully ended stream with no result from the no-charge cache path', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(sseResponse('event: status\ndata: {"phase":"ai_processing"}\n\n'))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          cards: [{
            section: 'General',
            issue: 'Cached issue',
            suggestion: 'Cached suggestion',
            exampleBefore: 'Before',
            exampleAfter: 'After',
          }],
          source: 'gemini',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      ));
    vi.stubGlobal('fetch', fetchMock);

    const result = await optimizeResumeStream({
      resumeText: 'Resume text with enough detail',
      jobDesc: 'Job description with enough detail',
    });

    expect(result.cards).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      cacheOnly: true,
    });
  });

  it.each(['\r\n\r\n', ''])('accepts a complete result with CRLF framing or at EOF (%j)', async (ending) => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(
      `event: result\r\ndata: {"cards":[{"id":"delivered"}]}${ending}`,
    ));
    vi.stubGlobal('fetch', fetchMock);
    const result = await optimizeResumeStream({ resumeText: 'CV', jobDesc: 'JD' });
    expect(result.cards[0].id).toBe('delivered');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('preserves an SSE error without retryable instead of swallowing it as invalid JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(
      'event: error\ndata: {"error":"Provider rejected","code":"AI_CONTRACT_VALIDATION_FAILED","status":502,"billingStateUnknown":false}\n\n',
    ));
    vi.stubGlobal('fetch', fetchMock);
    await expect(optimizeResumeStream({ resumeText: 'CV', jobDesc: 'JD' })).rejects.toMatchObject({
      message: 'Provider rejected', code: 'AI_CONTRACT_VALIDATION_FAILED', status: 502,
      isBillingStateUnknown: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('waits for an in-flight result to reach cache without starting another generation', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(interruptedStreamResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ cacheOnlyMiss: true }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ cards: [{ id: 'later' }] }), {
        headers: { 'Content-Type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);
    const pending = optimizeResumeStream({ resumeText: 'CV', jobDesc: 'JD' });
    const assertion = expect(pending).resolves.toMatchObject({ cards: [{ id: 'later' }] });
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.slice(1).every(([, init]) => JSON.parse(init.body).cacheOnly)).toBe(true);
  });
});
