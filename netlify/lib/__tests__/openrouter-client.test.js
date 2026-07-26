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

const getParseResumeSchema = async () => {
  const { aiContracts } = await import('../ai-contracts/contracts/index.js');
  return aiContracts.parse_resume.jsonSchema;
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

  it('throws the original eligible OpenRouter error without a Gemini fallback when disabled', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(503, { error: { message: 'OpenRouter unavailable' } }, 'Service Unavailable'),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { callOpenRouter } = await importClient();

    await expect(callOpenRouter('lite', MESSAGES, null, {
      timeoutMs: 1000,
      disableFallback: true,
    })).rejects.toThrow('OpenRouter API error (503)');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  it('rejects Gemini-only execution when fallback is disabled', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { callOpenRouter } = await importClient({ openRouterKey: '' });

    await expect(callOpenRouter('lite', MESSAGES, null, {
      timeoutMs: 1000,
      disableFallback: true,
    })).rejects.toThrow('OPENROUTER_API_KEY');

    expect(fetchMock).not.toHaveBeenCalled();
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
      user_ref: null,
      jd_fingerprint: null,
      success: true,
      error_code: null,
    }));
  });

  it('preserves pseudonymous attribution through the contract executor', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, {
      choices: [{ message: { content: JSON.stringify({
        clarifications: [{
          id: 'excelExperience',
          theme: 'Excel',
          rationale: 'The job requires Excel evidence.',
          question: 'Which Excel work can you verify?',
          type: 'multi',
          options: [
            { value: 'dashboards', label: 'Built Excel dashboards' },
            { value: 'no_excel', label: "I don't have Excel experience", isHardStop: true },
          ],
          allowOther: true,
        }],
      }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await importClient({ geminiKey: '' });
    const { executeAiContract } = await import('../ai-contracts/executor.js');
    await executeAiContract('clarification_questions', {
      resumeText: 'Analyst resume',
      jobText: 'Excel analyst job',
      language: 'en',
    }, {
      userRef: '11111111-1111-4111-8111-111111111111',
      jdFingerprint: '34ed4647ad9866d5',
    });

    expect(mocks.recordAiUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      user_ref: '11111111-1111-4111-8111-111111111111',
      jd_fingerprint: '34ed4647ad9866d5',
    }));
  });

  it('sends explicit parse_resume section properties through OpenRouter structured output', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, {
      choices: [{ message: { content: '{"basics":{}}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { callOpenRouter } = await importClient();
    await callOpenRouter('lite', MESSAGES, await getParseResumeSchema(), {
      timeoutMs: 1000,
      featureName: 'parse_resume',
      schemaName: 'parse_resume',
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const providerSchema = requestBody.response_format.json_schema.schema;
    const properties = providerSchema.properties;
    expect(providerSchema.required).toEqual(expect.arrayContaining([
      'education', 'skills', 'projects', 'certificates', 'languages',
    ]));
    expect(properties.education.items.properties).toHaveProperty('institution');
    expect(properties.skills.items.properties).toHaveProperty('keywords');
    expect(properties.projects.items.properties).toHaveProperty('description');
    expect(properties.certificates.items.properties).toHaveProperty('issuer');
    expect(properties.languages.items.properties).toHaveProperty('fluency');
  });

  it('sends explicit parse_resume section properties through direct Gemini structured output', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, {
      candidates: [{ content: { parts: [{ text: '{"basics":{}}' }] } }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { callOpenRouter } = await importClient({ openRouterKey: '' });
    await callOpenRouter('lite', MESSAGES, await getParseResumeSchema(), {
      timeoutMs: 1000,
      featureName: 'parse_resume',
      schemaName: 'parse_resume',
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const providerSchema = requestBody.generationConfig.responseSchema;
    const properties = providerSchema.properties;
    expect(providerSchema.required).toEqual(expect.arrayContaining([
      'education', 'skills', 'projects', 'certificates', 'languages',
    ]));
    expect(properties.education.items.properties).toHaveProperty('institution');
    expect(properties.skills.items.properties).toHaveProperty('keywords');
    expect(properties.projects.items.properties).toHaveProperty('description');
    expect(properties.certificates.items.properties).toHaveProperty('issuer');
    expect(properties.languages.items.properties).toHaveProperty('fluency');
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

  it('throws fast on parse_resume truncation WITHOUT a second (Gemini) generation', async () => {
    // Re-parsing the full resume on Gemini after a truncation stacked two
    // multi-second generations and overran the 30s function limit in production.
    // Truncation is not a provider outage, so it must throw immediately and let
    // the caller recover deterministically — never trigger the Gemini fallback.
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, {
      choices: [{ message: { content: '{"basics":{"name":"Abdullah' }, finish_reason: 'length' }],
      usage: { prompt_tokens: 1282, completion_tokens: 8192, total_tokens: 9474 },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { callOpenRouter } = await importClient();

    await expect(callOpenRouter('lite', MESSAGES, null, {
      timeoutMs: 1000,
      featureName: 'parse_resume',
    })).rejects.toThrow(/truncated/i);

    // Exactly ONE provider call — no Gemini re-parse.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.recordAiUsageEvent).not.toHaveBeenCalledWith(expect.objectContaining({
      provider: 'gemini',
    }));
    expect(mocks.recordAiUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'openrouter',
      success: false,
      error_code: 'TruncationError',
    }));
  });

  it('fails loud when direct Gemini truncates at maxOutputTokens', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, {
      candidates: [{ content: { parts: [{ text: '{"basics":{"name":"Abdullah' }] }, finishReason: 'MAX_TOKENS' }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { callOpenRouter } = await importClient({ openRouterKey: '' });

    await expect(callOpenRouter('lite', MESSAGES, null, {
      timeoutMs: 1000,
      featureName: 'parse_resume',
    })).rejects.toThrow(/truncated/i);

    expect(mocks.recordAiUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'gemini',
      success: false,
      error_code: 'TruncationError',
    }));
  });

  it('disables reasoning on the OpenRouter request when reasoningBudget is 0', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, {
      choices: [{ message: { content: '{"ok":1}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { callOpenRouter } = await importClient();
    await callOpenRouter('lite', MESSAGES, null, {
      timeoutMs: 1000,
      featureName: 'parse_resume',
      reasoningBudget: 0,
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.reasoning).toEqual({ enabled: false });
  });

  it('disables thinking on the direct Gemini request when reasoningBudget is 0', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, {
      candidates: [{ content: { parts: [{ text: '{"ok":1}' }] } }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { callOpenRouter } = await importClient({ openRouterKey: '' });
    await callOpenRouter('lite', MESSAGES, null, {
      timeoutMs: 1000,
      featureName: 'parse_resume',
      reasoningBudget: 0,
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it('caps reasoning with max_tokens/exclude when reasoningBudget is a positive number', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, {
      choices: [{ message: { content: '{"ok":1}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { callOpenRouter } = await importClient();
    await callOpenRouter('flash', MESSAGES, null, {
      timeoutMs: 1000,
      featureName: 'ai_match',
      reasoningBudget: 512,
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.reasoning).toEqual({ max_tokens: 512, exclude: true });
  });

  it('omits the reasoning field entirely when reasoningBudget is null', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, {
      choices: [{ message: { content: '{"ok":1}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { callOpenRouter } = await importClient();
    await callOpenRouter('flash', MESSAGES, null, {
      timeoutMs: 1000,
      featureName: 'ai_match',
      reasoningBudget: null,
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.reasoning).toBeUndefined();
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

  it('waits for successful usage telemetry before resolving OpenRouter content', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, {
      choices: [{ message: { content: '{"test":1}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }));
    vi.stubGlobal('fetch', fetchMock);

    let resolveTelemetry;
    const telemetryDone = new Promise(resolve => {
      resolveTelemetry = resolve;
    });
    mocks.recordAiUsageEvent.mockReturnValueOnce(telemetryDone);

    const { callOpenRouter } = await importClient();
    let resolved = false;
    const promise = callOpenRouter('lite', MESSAGES, null, {
      timeoutMs: 1000,
      featureName: 'parse_resume',
    }).then((content) => {
      resolved = true;
      return content;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    resolveTelemetry();
    await expect(promise).resolves.toBe('{"test":1}');
    expect(resolved).toBe(true);
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
