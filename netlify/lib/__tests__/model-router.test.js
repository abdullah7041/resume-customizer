import { describe, expect, it } from 'vitest';

describe('model-router', () => {
  it('resolves correct default config for each known feature', async () => {
    const { resolveFeatureConfig } = await import('../model-router.js');
    const { MODELS } = await import('../model-registry.js');

    const parseConfig = resolveFeatureConfig('parse_resume');
    expect(parseConfig.modelType).toBe('lite');
    expect(parseConfig.modelId).toBe(MODELS.lite);
    expect(parseConfig.maxTokens).toBe(3072);

    const matchConfig = resolveFeatureConfig('ai_match');
    expect(matchConfig.modelType).toBe('flash');
    expect(matchConfig.modelId).toBe(MODELS.flash);
    expect(matchConfig.maxTokens).toBe(16384);

    const optimizeConfig = resolveFeatureConfig('optimize');
    expect(optimizeConfig.modelType).toBe('flash');
    expect(optimizeConfig.modelId).toBe(MODELS.flash);
    expect(optimizeConfig.reasoningBudget).toBe(2048);
  });

  it('rejects unknown features with a clear error', async () => {
    const { resolveFeatureConfig } = await import('../model-router.js');
    expect(() => resolveFeatureConfig('unknown_feature')).toThrow(
      /Unknown feature "unknown_feature"/
    );
  });

  it('allows explicit caller override of modelId without env gate', async () => {
    const { resolveFeatureConfig } = await import('../model-router.js');
    const config = resolveFeatureConfig('optimize', { modelId: 'google/gemini-3.1-flash-lite' });
    expect(config.modelId).toBe('google/gemini-3.1-flash-lite');
    expect(config.geminiModelId).toBe('gemini-3.1-flash-lite');
  });

  it('caller modelId override takes precedence over env override', async () => {
    process.env.WATHEQ_AI_ENABLE_MODEL_OVERRIDES = 'true';
    process.env.WATHEQ_AI_MODEL_OVERRIDE_OPTIMIZE = 'google/gemini-2.5-flash-lite';

    const { resolveFeatureConfig } = await import('../model-router.js');
    const config = resolveFeatureConfig('optimize', { modelId: 'google/gemini-3.1-flash-lite' });
    expect(config.modelId).toBe('google/gemini-3.1-flash-lite');

    delete process.env.WATHEQ_AI_ENABLE_MODEL_OVERRIDES;
    delete process.env.WATHEQ_AI_MODEL_OVERRIDE_OPTIMIZE;
  });

  it('falls back to default geminiModelId when modelId lacks google/ prefix', async () => {
    const { resolveFeatureConfig } = await import('../model-router.js');
    const config = resolveFeatureConfig('ai_match', { modelId: 'some-custom-model' });
    expect(config.modelId).toBe('some-custom-model');
    expect(config.geminiModelId).toBe('some-custom-model');
  });
});
