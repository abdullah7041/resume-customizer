/**
 * Model Router — Resolves feature-specific AI model configuration.
 *
 * Rules:
 * - Production defaults are returned when no overrides are configured.
 * - Env overrides are ignored unless WATHEQ_AI_ENABLE_MODEL_OVERRIDES=true.
 * - Explicit caller overrides (options.modelId) are applied for benchmark use.
 * - Unknown features are rejected with a clear error.
 */

import {
  MODELS,
  FEATURE_CONFIGS,
  isOverrideGateEnabled,
  getEnvOverrideModelId,
  estimateCostUsd,
} from './model-registry.js';

/**
 * Resolve the full configuration for a given feature.
 *
 * @param {string} featureName — one of the keys in FEATURE_CONFIGS
 * @param {object} [optionsOverride] — optional caller overrides (e.g., benchmark modelId)
 * @returns {{
 *   modelType: 'lite' | 'flash',
 *   modelId: string,
 *   geminiModelId: string,
 *   maxTokens: number,
 *   temperature: number,
 *   reasoningBudget: number | null,
 *   timeoutMs: number,
 *   featureName: string,
 * }}
 */
export function resolveFeatureConfig(featureName, optionsOverride = {}) {
  const knownFeatures = Object.keys(FEATURE_CONFIGS);
  if (!knownFeatures.includes(featureName)) {
    throw new Error(
      `[ModelRouter] Unknown feature "${featureName}". Known features: ${knownFeatures.join(', ')}`
    );
  }

  const base = FEATURE_CONFIGS[featureName];
  const defaultModelId = MODELS[base.modelType];

  // Apply env overrides only when the safety gate is enabled
  const envModelId = isOverrideGateEnabled() ? getEnvOverrideModelId(featureName, defaultModelId) : defaultModelId;

  // Caller override (e.g., benchmark script) takes highest precedence
  const finalModelId = optionsOverride.modelId || envModelId;

  // Map back to gemini direct model ID
  const finalGeminiModelId = finalModelId.startsWith('google/')
    ? finalModelId.replace('google/', '')
    : finalModelId;

  return {
    modelType: base.modelType,
    modelId: finalModelId,
    geminiModelId: finalGeminiModelId,
    maxTokens: optionsOverride.maxTokens ?? base.maxTokens,
    temperature: optionsOverride.temperature ?? base.temperature,
    reasoningBudget: optionsOverride.reasoningBudget ?? base.reasoningBudget,
    timeoutMs: optionsOverride.timeoutMs ?? base.timeoutMs,
    featureName,
  };
}

/**
 * Compute approximate cost for a completed call.
 * Returns null if pricing is unknown for the model.
 */
export function computeApproximateCost(modelId, promptTokens, completionTokens) {
  return estimateCostUsd(modelId, promptTokens, completionTokens);
}
