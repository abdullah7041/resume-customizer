/**
 * Model Registry — Central backend-only model configuration.
 *
 * Rules:
 * - Production defaults are NEVER changed without benchmark proof.
 * - Env overrides require WATHEQ_AI_ENABLE_MODEL_OVERRIDES=true.
 * - Benchmark candidate models are explicitly listed; not production defaults.
 * - Pricing is APPROXIMATE only; do not use as a billing source of truth.
 */

// ---------------------------------------------------------------------------
// Production defaults — these are the current shipped model IDs
// ---------------------------------------------------------------------------
const MODELS = {
  lite:  'google/gemini-2.5-flash-lite',
  flash: 'google/gemini-2.5-flash',
};

// Direct Google fallback IDs (without the google/ prefix)
const GEMINI_MODELS = {
  lite:  'gemini-2.5-flash-lite',
  flash: 'gemini-2.5-flash',
};

// ---------------------------------------------------------------------------
// Benchmark candidate models — safe to evaluate, NOT production defaults
// ---------------------------------------------------------------------------
const SUPPORTED_BENCHMARK_MODELS = [
  'google/gemini-2.5-flash-lite',
  'google/gemini-2.5-flash',
  'google/gemini-3.1-flash-lite',
];

// ---------------------------------------------------------------------------
// Per-tier output token defaults
// ---------------------------------------------------------------------------
const DEFAULT_MAX_TOKENS = {
  lite: 4096,
  flash: 6144,
};

// ---------------------------------------------------------------------------
// Per-feature model configuration
// ---------------------------------------------------------------------------
const FEATURE_CONFIGS = {
  parse_resume: {
    modelType: 'lite',
    maxTokens: 3072,
    temperature: 0,
    reasoningBudget: null,
    timeoutMs: 50000,
  },
  ai_match: {
    modelType: 'flash',
    maxTokens: 16384,
    temperature: 0,
    reasoningBudget: 1024,
    timeoutMs: 65000,
  },
  ai_match_reality_check: {
    modelType: 'flash',
    maxTokens: 6144,
    temperature: 0,
    reasoningBudget: 512,
    timeoutMs: 65000,
  },
  resume_truth_check: {
    modelType: 'flash',
    maxTokens: 6144,
    temperature: 0,
    reasoningBudget: 512,
    timeoutMs: 65000,
  },
  job_metadata_extraction: {
    modelType: 'lite',
    maxTokens: 1024,
    temperature: 0,
    reasoningBudget: null,
    timeoutMs: 15000,
  },
  clarification_questions: {
    modelType: 'flash',
    maxTokens: 2048,
    temperature: 0,
    reasoningBudget: 512,
    timeoutMs: 20000,
  },
  optimize: {
    modelType: 'flash',
    maxTokens: 16384,
    temperature: 0,
    reasoningBudget: 2048,
    timeoutMs: 100000,
  },
  cover_letter: {
    modelType: 'flash',
    maxTokens: 16384,
    temperature: 0,
    reasoningBudget: 1024,
    timeoutMs: 50000,
  },
  interview_prep: {
    modelType: 'lite',
    maxTokens: 4096,
    temperature: 0.3,
    reasoningBudget: null,
    timeoutMs: 50000,
  },
  vision2030: {
    modelType: 'flash',
    maxTokens: 16384,
    temperature: 0.3,
    reasoningBudget: null,
    timeoutMs: 50000,
  },
};

// ---------------------------------------------------------------------------
// Approximate pricing (USD per 1M tokens) — NOT actual billed cost.
// Update these when provider pricing changes.
// ---------------------------------------------------------------------------
const APPROXIMATE_PRICING = {
  'google/gemini-2.5-flash-lite': { prompt: 0.30, completion: 0.60 },
  'google/gemini-2.5-flash':      { prompt: 0.50, completion: 2.00 },
  'google/gemini-3.1-flash-lite': { prompt: 0.15, completion: 0.60 },
};

/**
 * Compute approximate cost in USD from token counts.
 * This is an estimate only; actual cost comes from provider billing.
 */
function estimateCostUsd(modelId, promptTokens, completionTokens) {
  const rates = APPROXIMATE_PRICING[modelId];
  if (!rates) return null;
  const promptCost = (promptTokens / 1_000_000) * rates.prompt;
  const completionCost = (completionTokens / 1_000_000) * rates.completion;
  return Number((promptCost + completionCost).toFixed(6));
}

// ---------------------------------------------------------------------------
// Env override helpers (gated by WATHEQ_AI_ENABLE_MODEL_OVERRIDES)
// ---------------------------------------------------------------------------
function isOverrideGateEnabled() {
  return process.env.WATHEQ_AI_ENABLE_MODEL_OVERRIDES === 'true';
}

function getEnvOverrideModelId(featureName, defaultModelId) {
  if (!isOverrideGateEnabled()) return defaultModelId;

  const envKey = `WATHEQ_AI_MODEL_OVERRIDE_${featureName.toUpperCase()}`;
  const override = process.env[envKey];
  if (override && SUPPORTED_BENCHMARK_MODELS.includes(override)) {
    return override;
  }

  // Check tier overrides
  const tier = defaultModelId === MODELS.lite ? 'LITE' : 'FLASH';
  const tierEnvKey = `WATHEQ_AI_MODEL_OVERRIDE_${tier}`;
  const tierOverride = process.env[tierEnvKey];
  if (tierOverride && SUPPORTED_BENCHMARK_MODELS.includes(tierOverride)) {
    return tierOverride;
  }

  return defaultModelId;
}

export {
  MODELS,
  GEMINI_MODELS,
  SUPPORTED_BENCHMARK_MODELS,
  DEFAULT_MAX_TOKENS,
  FEATURE_CONFIGS,
  APPROXIMATE_PRICING,
  estimateCostUsd,
  isOverrideGateEnabled,
  getEnvOverrideModelId,
};
