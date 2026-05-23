import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  recordAiUsageEvent: vi.fn().mockResolvedValue(undefined),
}));

const ORIGINAL_ENV = { ...process.env };
const MESSAGES = [{ role: 'user', content: 'Return JSON.' }];

vi.mock('../ai-usage-logger.js', () => ({
  recordAiUsageEvent: mocks.recordAiUsageEvent,
}));

vi.mock('../sentry.js', () => ({
  summarizeErrorForLog: vi.fn((error) => error instanceof Error
    ? { name: error.name, message: error.message, status: error.status }
    : { message: String(error) }),
}));

const jsonResponse = (status, body, statusText = 'OK') => ({
  ok: status >= 200 && status < 300,
  status,
  statusText,
  json: vi.fn().mockResolvedValue(body),
});

const importClient = async ({ openRouterKey = 'openrouter-key', geminiKey = 'gemini-key' } = {}) => {
  vi.resetModules();
  process.env.OPENROUTER_API_KEY = openRouterKey;
  process.env.GEMINI_API_KEY = geminiKey;
  process.env.SITE_URL = 'https://watheq.test';
  return import('../openrouter-client.js');
};

describe('openrouter-client fallback and timeout behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.recordAiUsageEvent.mockClear();
    mocks.recordAiUsageEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    process.env = { ...ORIGINAL_ENV };
  });

  it('falls back to direct Gemini when OpenRouter returns a provider failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(503, { error: { message: 'OpenRouter unavailable' } }, 'Service Unavailable'))
      .mockResolvedValueOnce(jsonResponse(200, {
        candidates: [
          { content: { parts: [{ text: '{"provider":"gemini"}' }] } },
        ],
      }));
    vi.stubGlobal('fetch', fetchMock);

    const { callOpenRouter } = await importClient();
    const content = await callOpenRouter('lite', MESSAGES, null, { timeoutMs: 1000 });

    expect(content).toBe('{"provider":"gemini"}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(fetchMock.mock.calls[1][0]).toContain('generativelanguage.googleapis.com');
    expect(mocks.recordAiUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'openrouter',
      model: 'google/gemini-2.5-flash-lite',
      success: false,
      error_code: '503',
    }));
    expect(mocks.recordAiUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
      success: true,
      error_code: null,
    }));
  });

  it('throws the original OpenRouter error when Gemini fallback also fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(502, { error: { message: 'Bad gateway' } }, 'Bad Gateway'))
      .mockResolvedValueOnce(jsonResponse(500, { error: { message: 'Gemini unavailable' } }, 'Internal Server Error'));
    vi.stubGlobal('fetch', fetchMock);

    const { callOpenRouter } = await importClient();

    await expect(callOpenRouter('flash', MESSAGES, null, { timeoutMs: 1000 }))
      .rejects.toThrow('OpenRouter API error (502)');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.recordAiUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'openrouter',
      model: 'google/gemini-2.5-flash',
      success: false,
      error_code: '502',
    }));
    expect(mocks.recordAiUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      success: false,
      error_code: '500',
    }));
  });

  it('records direct Gemini usage when OpenRouter is not configured', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, {
      candidates: [
        { content: { parts: [{ text: '{"provider":"gemini-direct"}' }] } },
      ],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { callOpenRouter } = await importClient({ openRouterKey: '' });
    const content = await callOpenRouter('lite', MESSAGES, null, {
      timeoutMs: 1000,
      featureName: 'parse_resume',
    });

    expect(content).toBe('{"provider":"gemini-direct"}');
    expect(mocks.recordAiUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      feature_name: 'parse_resume',
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
      success: true,
      error_code: null,
    }));
  });

  it('records direct Gemini failures with the Gemini provider label', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(500, {
      error: { message: 'Gemini unavailable' },
    }, 'Internal Server Error'));
    vi.stubGlobal('fetch', fetchMock);

    const { callOpenRouter } = await importClient({ openRouterKey: '' });

    await expect(callOpenRouter('flash', MESSAGES, null, {
      timeoutMs: 1000,
      featureName: 'cover_letter',
    })).rejects.toThrow('Gemini API error (500)');

    expect(mocks.recordAiUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      feature_name: 'cover_letter',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      success: false,
      error_code: '500',
    }));
  });

  it('does not record OpenRouter success before validating response content', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, {
      choices: [{ message: { content: '' } }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 0,
        total_tokens: 10,
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { callOpenRouter } = await importClient({ geminiKey: '' });

    await expect(callOpenRouter('flash', MESSAGES, null, {
      timeoutMs: 1000,
      featureName: 'ai_match',
    })).rejects.toThrow('OpenRouter returned empty response');

    expect(mocks.recordAiUsageEvent).not.toHaveBeenCalledWith(expect.objectContaining({
      provider: 'openrouter',
      success: true,
    }));
    expect(mocks.recordAiUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      feature_name: 'ai_match',
      provider: 'openrouter',
      success: false,
      error_code: 'Error',
    }));
  });

  it('uses options.modelId when explicitly provided', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, {
      choices: [{ message: { content: '{"custom":true}' } }],
      usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { callOpenRouter } = await importClient();
    const content = await callOpenRouter('flash', MESSAGES, null, {
      timeoutMs: 1000,
      featureName: 'ai_match',
      modelId: 'google/gemini-3.1-flash-lite',
    });

    expect(content).toBe('{"custom":true}');
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.model).toBe('google/gemini-3.1-flash-lite');
    expect(mocks.recordAiUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      model: 'google/gemini-3.1-flash-lite',
      estimated_cost_usd: expect.any(Number),
    }));
  });

  it('uses options.modelId for direct Gemini calls when explicitly provided', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, {
      candidates: [
        { content: { parts: [{ text: '{"custom":true}' }] } },
      ],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { callOpenRouter } = await importClient({ openRouterKey: '' });
    const content = await callOpenRouter('flash', MESSAGES, null, {
      timeoutMs: 1000,
      featureName: 'benchmark.match',
      modelId: 'google/gemini-3.1-flash-lite',
    });

    expect(content).toBe('{"custom":true}');
    expect(fetchMock.mock.calls[0][0]).toContain('/gemini-3.1-flash-lite:generateContent');
    expect(mocks.recordAiUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      feature_name: 'benchmark.match',
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
      success: true,
    }));
  });

  it('records approximate estimated_cost_usd for known models', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, {
      choices: [{ message: { content: '{"test":1}' } }],
      usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { callOpenRouter } = await importClient();
    await callOpenRouter('lite', MESSAGES, null, {
      timeoutMs: 1000,
      featureName: 'parse_resume',
      modelId: 'google/gemini-2.5-flash-lite',
    });

    expect(mocks.recordAiUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      model: 'google/gemini-2.5-flash-lite',
      estimated_cost_usd: expect.any(Number),
    }));
  });

  it('records null estimated_cost_usd for unknown models', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, {
      choices: [{ message: { content: '{"test":1}' } }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { callOpenRouter } = await importClient();
    await callOpenRouter('flash', MESSAGES, null, {
      timeoutMs: 1000,
      featureName: 'ai_match',
      modelId: 'unknown/model-v1',
    });

    expect(mocks.recordAiUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      model: 'unknown/model-v1',
      estimated_cost_usd: null,
    }));
  });

  it('raises a retryable TimeoutError when the active AI request exceeds timeoutMs', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        reject(error);
      });
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { callOpenRouter } = await importClient({ geminiKey: '' });
    const promise = callOpenRouter('flash', MESSAGES, null, { timeoutMs: 25 }).catch(error => error);

    await vi.advanceTimersByTimeAsync(25);
    const error = await promise;

    expect(error).toMatchObject({
      name: 'TimeoutError',
      status: 504,
    });
    expect(error.message).toContain('automatically retried on the client');
  });
});
