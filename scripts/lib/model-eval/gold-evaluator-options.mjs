import { SUPPORTED_BENCHMARK_MODELS } from '../../../netlify/lib/model-registry.js';

import { classifyAttempt } from './attempts.mjs';
import { parseEvaluationArgs } from './cli.mjs';
import { summarizeLatencies } from './statistics.mjs';

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

const OPTIMIZE_MATRIX_FLAGS = new Set([
  '--feature',
  '--models',
  '--runs',
  '--stage',
  '--update-cache',
  '--report-dir',
]);
const OPTIMIZE_SHARED_VALUE_FLAGS = new Set([
  '--feature',
  '--runs',
  '--fixture',
  '--stage',
  '--report-dir',
]);

const requiredOptionValue = (argv, index, flag) => {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new TypeError(`${flag} requires a value.`);
  }
  return value;
};

const modelList = (value) => value.split(',').map((modelId) => modelId.trim()).filter(Boolean);

export const parseOptimizeGoldEvaluatorOptions = ({ defaultModelId, argv = [] } = {}) => {
  if (!Array.isArray(argv)) {
    throw new TypeError('Optimize evaluator arguments must be an array.');
  }

  const matrixRequested = argv.some((arg) => OPTIMIZE_MATRIX_FLAGS.has(arg));
  const normalizedArgv = [];
  const explicitModels = [];
  const candidates = [];
  let baseline = null;
  let legacyModelFlagPresent = false;

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--update-cache') {
      normalizedArgv.push(flag);
      continue;
    }
    if (flag === '--baseline' || flag === '--candidate' || flag === '--models') {
      const value = requiredOptionValue(argv, index, flag);
      index += 1;
      if (flag === '--baseline') {
        baseline = value;
        legacyModelFlagPresent = true;
      } else if (flag === '--candidate') {
        candidates.push(...modelList(value));
        legacyModelFlagPresent = true;
      } else {
        explicitModels.push(...modelList(value));
      }
      continue;
    }
    if (OPTIMIZE_SHARED_VALUE_FLAGS.has(flag)) {
      const value = requiredOptionValue(argv, index, flag);
      normalizedArgv.push(flag, value);
      index += 1;
    }
  }

  const evaluationRequested = matrixRequested || legacyModelFlagPresent;
  if (!evaluationRequested) {
    return {
      ...parseGoldEvaluatorOptions({
        feature: 'optimize',
        defaultModelId,
        argv: [],
      }),
      matrixRequested: false,
    };
  }

  const models = [
    ...(legacyModelFlagPresent ? [baseline || defaultModelId] : []),
    ...candidates,
    ...explicitModels,
  ];
  if (models.length > 0) {
    normalizedArgv.push('--models', [...new Set(models)].join(','));
  }

  return {
    ...parseGoldEvaluatorOptions({
      feature: 'optimize',
      defaultModelId,
      argv: normalizedArgv,
    }),
    matrixRequested,
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

export const buildGoldScoreSummaries = (attempts) => {
  if (!Array.isArray(attempts)) {
    throw new TypeError('Gold attempts must be an array.');
  }

  const groups = new Map();
  for (const attempt of attempts) {
    if (typeof attempt?.modelId !== 'string' || typeof attempt?.fixtureId !== 'string') {
      throw new TypeError('Gold score summaries require modelId and fixtureId.');
    }
    const key = `${attempt.modelId}\0${attempt.fixtureId}`;
    const entries = groups.get(key) ?? [];
    entries.push(attempt);
    groups.set(key, entries);
  }

  return [...groups.values()].map((entries) => {
    const { modelId, fixtureId } = entries[0];
    const scores = entries.map((entry) => entry.score).filter(Number.isFinite);
    const latencies = entries.map((entry) => entry.latencyMs).filter(Number.isFinite);
    const costs = entries.map((entry) => entry.approximateCostUsd).filter(Number.isFinite);
    const primarySuccesses = entries.filter(
      (entry) => entry.classification?.primarySuccess === true,
    ).length;
    const latency = latencies.length > 0 ? summarizeLatencies(latencies) : null;

    return {
      modelId,
      fixtureId,
      attempts: entries.length,
      primarySuccesses,
      failures: entries.length - primarySuccesses,
      meanScore: scores.length > 0
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : null,
      minScore: scores.length > 0 ? Math.min(...scores) : null,
      maxScore: scores.length > 0 ? Math.max(...scores) : null,
      p50LatencyMs: latency?.p50Ms ?? null,
      p95LatencyMs: latency?.p95Ms ?? null,
      approximateCostUsd: costs.length > 0
        ? Number(costs.reduce((sum, cost) => sum + cost, 0).toFixed(6))
        : null,
    };
  });
};

const JUDGE_DIMENSIONS = ['specificity', 'jd_alignment', 'truthfulness', 'readability'];

export const validateOptimizeJudgeResult = ({ parsed, labelMap } = {}) => {
  const failureReasons = [];
  const byVariant = {};
  const evaluations = Array.isArray(parsed?.evaluations) ? parsed.evaluations : [];

  for (const [label, variantName] of Object.entries(labelMap ?? {})) {
    const matches = evaluations.filter((evaluation) => evaluation?.label === label);
    if (matches.length === 0) {
      failureReasons.push(`missing_variant:${variantName}`);
      continue;
    }
    if (matches.length > 1) {
      failureReasons.push(`duplicate_variant:${variantName}`);
      continue;
    }

    const evaluation = matches[0];
    const scores = {};
    let valid = true;
    for (const dimension of JUDGE_DIMENSIONS) {
      const score = evaluation[dimension];
      if (!Number.isFinite(score) || score < 1 || score > 5) {
        failureReasons.push(`invalid_dimension:${variantName}:${dimension}`);
        valid = false;
      } else {
        scores[dimension] = score;
      }
    }
    if (valid) byVariant[variantName] = scores;
  }

  if (!Object.hasOwn(labelMap ?? {}, parsed?.best_label)) {
    failureReasons.push('invalid_best_label');
  }

  return {
    requiredFailure: failureReasons.length > 0,
    failureReasons,
    byVariant,
  };
};

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
