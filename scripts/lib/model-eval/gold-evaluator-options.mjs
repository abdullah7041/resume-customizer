import { SUPPORTED_BENCHMARK_MODELS } from '../../../netlify/lib/model-registry.js';

import { classifyAttempt } from './attempts.mjs';
import { parseEvaluationArgs } from './cli.mjs';

const GOLD_FEATURES = new Set(['parse', 'match', 'optimize']);

const assertGoldFeature = (feature) => {
  if (!GOLD_FEATURES.has(feature)) {
    throw new TypeError('Gold evaluator feature must be parse, match, or optimize.');
  }
};

const cachePolicyFor = (mode, updateCache) => mode === 'evaluation'
  ? { read: false, write: updateCache === true }
  : { read: true, write: true };

export const parseGoldEvaluatorOptions = ({ feature, defaultModelId, argv = [] } = {}) => {
  assertGoldFeature(feature);
  if (typeof defaultModelId !== 'string' || !defaultModelId) {
    throw new TypeError('Gold evaluator defaultModelId is required.');
  }
  if (!Array.isArray(argv)) {
    throw new TypeError('Gold evaluator arguments must be an array.');
  }

  if (argv.length === 0) {
    return {
      mode: 'production',
      feature,
      models: [],
      runs: 1,
      fixture: null,
      stage: null,
      updateCache: false,
      reportDir: null,
      selftest: false,
      cachePolicy: cachePolicyFor('production', false),
    };
  }

  const normalizedArgv = argv.includes('--feature')
    ? [...argv]
    : ['--feature', feature, ...argv];
  const parsed = parseEvaluationArgs(normalizedArgv);
  if (parsed.feature !== feature) {
    throw new TypeError(`This evaluator only supports --feature ${feature}.`);
  }

  if (parsed.selftest) {
    return {
      ...parsed,
      mode: 'selftest',
      cachePolicy: { read: false, write: false },
    };
  }

  const models = parsed.models.length > 0 ? parsed.models : [defaultModelId];
  const unsupported = models.filter((modelId) => !SUPPORTED_BENCHMARK_MODELS.includes(modelId));
  if (unsupported.length > 0) {
    throw new TypeError(`Unsupported benchmark model: ${unsupported.join(', ')}`);
  }

  return {
    ...parsed,
    mode: 'evaluation',
    models,
    cachePolicy: cachePolicyFor('evaluation', parsed.updateCache),
  };
};

export const buildGoldContractOptions = ({ feature, mode, modelId } = {}) => {
  assertGoldFeature(feature);
  if (mode !== 'evaluation') return {};
  if (typeof modelId !== 'string' || !modelId) {
    throw new TypeError('Evaluation contract options require a modelId.');
  }

  return {
    modelId,
    disableFallback: true,
    featureName: `benchmark.${feature}`,
  };
};

export const buildGoldEvaluationAttempts = ({
  feature,
  fixtureIds,
  models,
  runs,
} = {}) => {
  assertGoldFeature(feature);
  if (!Array.isArray(fixtureIds) || fixtureIds.length === 0) {
    throw new TypeError('Gold evaluation attempts require fixture IDs.');
  }
  if (!Array.isArray(models) || models.length === 0) {
    throw new TypeError('Gold evaluation attempts require model IDs.');
  }
  if (!Number.isInteger(runs) || runs < 1) {
    throw new TypeError('Gold evaluation attempts require at least one run.');
  }

  return models.flatMap((modelId) => fixtureIds.flatMap((fixtureId) => (
    Array.from({ length: runs }, (_, index) => ({
      modelId,
      fixtureId,
      run: index + 1,
      contractOptions: buildGoldContractOptions({
        feature,
        mode: 'evaluation',
        modelId,
      }),
    }))
  )));
};

const failureReasonFor = (error) => {
  if (!error) return 'schema_invalid';
  if (error.name === 'TimeoutError' || error.status === 504) return 'timeout';
  if (error.name === 'SyntaxError' || error.code === 'AI_CONTRACT_JSON_PARSE_FAILED') {
    return 'malformed_json';
  }
  if (error.code === 'AI_CONTRACT_VALIDATION_FAILED') return 'schema_invalid';
  if ([401, 403, 404, 408, 429, 500, 502, 503].includes(error.status)) {
    return 'provider_unavailable';
  }
  return 'contract_error';
};

export const classifyGoldResult = ({ error = null, schemaValid = error == null } = {}) => classifyAttempt({
  provider: 'openrouter',
  schemaValid: schemaValid === true && error == null,
  failureReason: error || schemaValid !== true ? failureReasonFor(error) : null,
});

const countWhere = (attempts, predicate) => attempts.filter(predicate).length;
const finiteValues = (attempts, key) => attempts
  .map((attempt) => attempt?.[key])
  .filter(Number.isFinite);

export const aggregateGoldAttempts = (attempts) => {
  if (!Array.isArray(attempts)) {
    throw new TypeError('Gold attempts must be an array.');
  }

  const primarySuccesses = countWhere(attempts, (attempt) => attempt?.classification?.primarySuccess === true);
  const requiredFailures = attempts.length - primarySuccesses;
  const latencies = finiteValues(attempts, 'latencyMs');
  const scores = finiteValues(attempts, 'score');
  const costs = finiteValues(attempts, 'approximateCostUsd');
  const failureReasons = [...new Set(attempts.flatMap(
    (attempt) => attempt?.classification?.failureReasons ?? [],
  ))];

  return {
    requiredFailure: requiredFailures > 0,
    meanScore: scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : null,
    latencies,
    approximateCostUsd: costs.length > 0
      ? costs.reduce((sum, cost) => sum + cost, 0)
      : null,
    outcomeSummary: {
      attempts: attempts.length,
      totalAttempts: attempts.length,
      primarySuccesses,
      successes: primarySuccesses,
      failures: requiredFailures,
      fallbackUsed: countWhere(attempts, (attempt) => attempt?.classification?.fallbackUsed === true),
      schemaValid: countWhere(attempts, (attempt) => attempt?.classification?.schemaValid === true),
      malformedJson: countWhere(attempts, (attempt) => attempt?.classification?.malformedJson === true),
      timeout: countWhere(attempts, (attempt) => attempt?.classification?.timeout === true),
      providerUnavailable: countWhere(
        attempts,
        (attempt) => attempt?.classification?.providerUnavailable === true,
      ),
      cacheUsed: countWhere(attempts, (attempt) => attempt?.classification?.cacheUsed === true),
      skipped: countWhere(attempts, (attempt) => attempt?.classification?.skipped === true),
      requiredFailures,
      qualityFailures: countWhere(attempts, (attempt) => attempt?.qualityPassed === false),
      failureReasons,
    },
  };
};
