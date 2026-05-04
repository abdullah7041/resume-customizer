import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };
const MESSAGES = [{ role: 'user', content: 'Return JSON.' }];

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
  });

  it('throws the original OpenRouter error when Gemini fallback also fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(502, { error: { message: 'Bad gateway' } }, 'Bad Gateway'))
      .mockResolvedValueOnce(jsonResponse(500, { error: { message: 'Gemini unavailable' } }, 'Internal Server Error'));
    vi.stubGlobal('fetch', fetchMock);

    const { callOpenRouter } = await importClient();

    await expect(callOpenRouter('flash', MESSAGES, null, { timeoutMs: 1000 }))
      .rejects.toThrow('OpenRouter API error (502): Bad gateway');
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
