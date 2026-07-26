import { beforeEach, describe, expect, it } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('model-registry', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.WATHEQ_AI_ENABLE_MODEL_OVERRIDES;
    delete process.env.WATHEQ_AI_MODEL_OVERRIDE_LITE;
    delete process.env.WATHEQ_AI_MODEL_OVERRIDE_FLASH;
    delete process.env.WATHEQ_AI_MODEL_OVERRIDE_OPTIMIZE;
  });

  it('exports current production defaults unchanged', async () => {
    const { GEMINI_MODELS, MODELS } = await import('../model-registry.js');
    expect(MODELS.lite).toBe('google/gemini-2.5-flash-lite');
    expect(MODELS.flash).toBe('google/gemini-2.5-flash');
    expect(GEMINI_MODELS).toEqual({
      lite: 'gemini-2.5-flash-lite',
      flash: 'gemini-2.5-flash',
    });
  });

  it('allows every approved benchmark candidate without changing production routing', async () => {
    const { SUPPORTED_BENCHMARK_MODELS } = await import('../model-registry.js');

    expect(SUPPORTED_BENCHMARK_MODELS).toEqual(expect.arrayContaining([
      'google/gemini-3.5-flash-lite',
      'google/gemini-3.1-flash-lite',
      'google/gemini-3.5-flash',
      'deepseek/deepseek-v4-flash',
      'qwen/qwen3.5-flash-02-23',
      'z-ai/glm-4.7-flash',
      'mistralai/mistral-small-3.2-24b-instruct',
    ]));
  });

  it('uses verified approximate pricing for every approved candidate', async () => {
    const { APPROXIMATE_PRICING } = await import('../model-registry.js');

    expect(APPROXIMATE_PRICING).toMatchObject({
      'google/gemini-3.5-flash-lite': { prompt: 0.30, completion: 2.50 },
      'google/gemini-3.1-flash-lite': { prompt: 0.25, completion: 1.50 },
      'google/gemini-3.5-flash': { prompt: 1.50, completion: 9.00 },
      'deepseek/deepseek-v4-flash': { prompt: 0.14, completion: 0.28 },
      'qwen/qwen3.5-flash-02-23': { prompt: 0.065, completion: 0.26 },
      'z-ai/glm-4.7-flash': { prompt: 0.06, completion: 0.40 },
      'mistralai/mistral-small-3.2-24b-instruct': { prompt: 0.10, completion: 0.30 },
    });
  });

  it('ignores env overrides when WATHEQ_AI_ENABLE_MODEL_OVERRIDES is absent', async () => {
    process.env.WATHEQ_AI_MODEL_OVERRIDE_FLASH = 'google/gemini-3.1-flash-lite';
    const { isOverrideGateEnabled, getEnvOverrideModelId, MODELS } = await import('../model-registry.js');
    expect(isOverrideGateEnabled()).toBe(false);
    const resolved = getEnvOverrideModelId('optimize', MODELS.flash);
    expect(resolved).toBe(MODELS.flash);
  });

  it('ignores env overrides when WATHEQ_AI_ENABLE_MODEL_OVERRIDES is not "true"', async () => {
    process.env.WATHEQ_AI_ENABLE_MODEL_OVERRIDES = 'false';
    process.env.WATHEQ_AI_MODEL_OVERRIDE_FLASH = 'google/gemini-3.1-flash-lite';
    const { isOverrideGateEnabled, getEnvOverrideModelId, MODELS } = await import('../model-registry.js');
    expect(isOverrideGateEnabled()).toBe(false);
    const resolved = getEnvOverrideModelId('optimize', MODELS.flash);
    expect(resolved).toBe(MODELS.flash);
  });

  it('applies env overrides when WATHEQ_AI_ENABLE_MODEL_OVERRIDES is "true"', async () => {
    process.env.WATHEQ_AI_ENABLE_MODEL_OVERRIDES = 'true';
    process.env.WATHEQ_AI_MODEL_OVERRIDE_FLASH = 'google/gemini-3.1-flash-lite';
    const { isOverrideGateEnabled, getEnvOverrideModelId, MODELS } = await import('../model-registry.js');
    expect(isOverrideGateEnabled()).toBe(true);
    const resolved = getEnvOverrideModelId('optimize', MODELS.flash);
    expect(resolved).toBe('google/gemini-3.1-flash-lite');
  });

  it('ignores unsupported model IDs in env overrides even when gate is enabled', async () => {
    process.env.WATHEQ_AI_ENABLE_MODEL_OVERRIDES = 'true';
    process.env.WATHEQ_AI_MODEL_OVERRIDE_FLASH = 'openai/gpt-4o';
    const { getEnvOverrideModelId, MODELS } = await import('../model-registry.js');
    const resolved = getEnvOverrideModelId('optimize', MODELS.flash);
    expect(resolved).toBe(MODELS.flash);
  });

  it('returns null estimatedCostUsd for unknown model', async () => {
    const { estimateCostUsd } = await import('../model-registry.js');
    expect(estimateCostUsd('unknown/model', 1000, 500)).toBeNull();
  });

  it('returns approximate cost for known models', async () => {
    const { estimateCostUsd } = await import('../model-registry.js');
    const cost = estimateCostUsd('google/gemini-3.1-flash-lite', 1_000_000, 1_000_000);
    expect(typeof cost).toBe('number');
    expect(cost).toBeGreaterThan(0);
  });
});
