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
    const { MODELS } = await import('../model-registry.js');
    expect(MODELS.lite).toBe('google/gemini-2.5-flash-lite');
    expect(MODELS.flash).toBe('google/gemini-2.5-flash');
  });

  it('includes google/gemini-3.1-flash-lite in SUPPORTED_BENCHMARK_MODELS', async () => {
    const { SUPPORTED_BENCHMARK_MODELS } = await import('../model-registry.js');
    expect(SUPPORTED_BENCHMARK_MODELS).toContain('google/gemini-3.1-flash-lite');
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
