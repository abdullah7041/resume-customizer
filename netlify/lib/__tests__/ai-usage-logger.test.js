import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
}));

vi.mock('../supabase-client.js', () => ({
  getSupabaseClient: mocks.getSupabaseClient,
}));

vi.mock('../sentry.js', () => ({
  summarizeErrorForLog: vi.fn((error) => ({
    message: error?.message || String(error),
    name: error?.name || 'Error',
  })),
}));

const baseEvent = {
  feature_name: 'ai_match',
  model: 'google/gemini-2.5-flash',
  provider: 'openrouter',
  prompt_tokens: 10,
  completion_tokens: 5,
  reasoning_tokens: 0,
  total_tokens: 15,
  estimated_cost_usd: null,
  latency_ms: 123,
  success: true,
  error_code: null,
};

describe('ai-usage-logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.getSupabaseClient.mockReset();
    delete process.env.BENCHMARK_DISABLE_USAGE_LOGGING;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('warns when Supabase resolves an insert error', async () => {
    const insert = vi.fn().mockResolvedValue({
      error: {
        message: 'relation "ai_usage_events" does not exist',
        code: '42P01',
        status: 404,
      },
    });
    mocks.getSupabaseClient.mockReturnValue({
      from: vi.fn(() => ({ insert })),
    });

    const { recordAiUsageEvent } = await import('../ai-usage-logger.js');
    await recordAiUsageEvent(baseEvent);
    await Promise.resolve();

    expect(console.warn).toHaveBeenCalledWith(
      '[AI Usage] Failed to persist event, non-fatal:',
      expect.objectContaining({
        message: 'relation "ai_usage_events" does not exist',
        code: '42P01',
        status: 404,
      }),
    );
  });

  it('does not warn when the insert resolves without an error', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    mocks.getSupabaseClient.mockReturnValue({
      from: vi.fn(() => ({ insert })),
    });

    const { recordAiUsageEvent } = await import('../ai-usage-logger.js');
    await recordAiUsageEvent(baseEvent);
    await Promise.resolve();

    expect(console.warn).not.toHaveBeenCalled();
  });

  it('returns after a bounded wait when telemetry persistence stalls', async () => {
    vi.useFakeTimers();
    const insert = vi.fn(() => new Promise(() => {}));
    mocks.getSupabaseClient.mockReturnValue({
      from: vi.fn(() => ({ insert })),
    });

    const { recordAiUsageEvent } = await import('../ai-usage-logger.js');
    const promise = recordAiUsageEvent(baseEvent);

    await vi.advanceTimersByTimeAsync(1500);

    await expect(promise).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      '[AI Usage] Persist attempt timed out, non-fatal:',
      expect.objectContaining({
        timeout_ms: 1500,
      }),
    );
  });

  it('skips persistence when BENCHMARK_DISABLE_USAGE_LOGGING is true', async () => {
    process.env.BENCHMARK_DISABLE_USAGE_LOGGING = 'true';
    mocks.getSupabaseClient.mockReturnValue({
      from: vi.fn(),
    });

    const { recordAiUsageEvent } = await import('../ai-usage-logger.js');
    await recordAiUsageEvent({ ...baseEvent, feature_name: 'benchmark.match' });

    expect(mocks.getSupabaseClient).not.toHaveBeenCalled();
  });
});
