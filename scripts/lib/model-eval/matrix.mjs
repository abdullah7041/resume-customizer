import { classifyAttempt } from './attempts.mjs';

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const assertModelId = (modelId, label) => {
  if (!isNonEmptyString(modelId)) {
    throw new TypeError(`${label} must be a non-empty model ID.`);
  }
};

const assertFixtureIds = (fixtureIds, label) => {
  if (!Array.isArray(fixtureIds) || fixtureIds.length === 0 || fixtureIds.some((fixtureId) => !isNonEmptyString(fixtureId))) {
    throw new TypeError(`${label} must contain non-empty fixture IDs.`);
  }
};

const uniqueModelIds = (modelIds) => [...new Set(modelIds)];

const REQUIRED_RUNS_BY_STAGE = new Map([
  [0, 1],
  [1, 1],
  [2, 3],
  [3, 5],
]);

const requiredRunsForStage = (stage) => {
  const requiredRuns = REQUIRED_RUNS_BY_STAGE.get(stage);
  if (!requiredRuns) {
    throw new TypeError('stage must be 0, 1, 2, or 3.');
  }
  return requiredRuns;
};

const classificationFor = (attempt) => {
  if (!attempt || typeof attempt !== 'object') {
    return classifyAttempt(attempt);
  }

  const { primarySuccess: _primarySuccess, ...rawAttempt } = attempt;
  const classification = classifyAttempt(rawAttempt);
  if (attempt.fallbackUsed === true) {
    return {
      ...classification,
      fallbackUsed: true,
      primarySuccess: false,
      failureReasons: [...new Set([...classification.failureReasons, 'fallback_used'])],
    };
  }
  return classification;
};

const isFiniteMetric = (value) => Number.isFinite(value) && value >= 0;

const completeForRecommendation = (model) => (
  model
  && isNonEmptyString(model.modelId)
  && typeof model.qualityPassed === 'boolean'
  && typeof model.reliabilityPassed === 'boolean'
  && Number.isFinite(model.qualityScore)
  && isFiniteMetric(model.p95LatencyMs)
  && isFiniteMetric(model.estimatedCostUsd)
  && model.p95LatencyMs > 0
  && model.estimatedCostUsd > 0
);

const hasCompletedStage3Confirmation = (model) => (
  model?.stage3Confirmation?.stage === 3
  && model.stage3Confirmation.completed === true
  && typeof model.stage3Confirmation.qualityPassed === 'boolean'
  && typeof model.stage3Confirmation.reliabilityPassed === 'boolean'
);

export const buildEvaluationStages = ({
  incumbent,
  candidates = [],
  eligibilityFixtureIds,
  fullFixtureIds,
  winner,
} = {}) => {
  assertModelId(incumbent, 'incumbent');
  if (!Array.isArray(candidates) || candidates.some((candidate) => !isNonEmptyString(candidate))) {
    throw new TypeError('candidates must contain non-empty model IDs.');
  }
  assertFixtureIds(eligibilityFixtureIds, 'eligibilityFixtureIds');
  assertFixtureIds(fullFixtureIds, 'fullFixtureIds');
  if (eligibilityFixtureIds.length !== 2) {
    throw new TypeError('eligibilityFixtureIds must contain one English and one Arabic fixture.');
  }
  assertModelId(winner, 'winner');

  const contenders = uniqueModelIds([incumbent, ...candidates]);
  const confirmationModels = uniqueModelIds([incumbent, winner]);

  return [
    {
      stage: 0,
      name: 'incumbent-sanity',
      models: [incumbent],
      fixtureIds: [...fullFixtureIds],
      runs: 1,
      fresh: false,
    },
    {
      stage: 1,
      name: 'bilingual-eligibility',
      models: contenders,
      fixtureIds: [...eligibilityFixtureIds],
      runs: 1,
      fresh: false,
    },
    {
      stage: 2,
      name: 'full-suite-screening',
      models: contenders,
      fixtureIds: [...fullFixtureIds],
      runs: 3,
      fresh: false,
    },
    {
      stage: 3,
      name: 'fresh-confirmation',
      models: confirmationModels,
      fixtureIds: [...fullFixtureIds],
      runs: 5,
      fresh: true,
    },
  ];
};

export const selectAdvancingModels = ({ stage = 1, modelIds, requiredFixtureIds, attempts = [] } = {}) => {
  if (!Array.isArray(modelIds) || modelIds.some((modelId) => !isNonEmptyString(modelId))) {
    throw new TypeError('modelIds must contain non-empty model IDs.');
  }
  assertFixtureIds(requiredFixtureIds, 'requiredFixtureIds');
  if (!Array.isArray(attempts)) {
    throw new TypeError('attempts must be an array.');
  }
  const requiredRuns = requiredRunsForStage(stage);

  const advanced = [];
  const excluded = [];

  for (const modelId of uniqueModelIds(modelIds)) {
    const modelAttempts = attempts.filter((attempt) => attempt?.modelId === modelId);
    if (modelAttempts.some((attempt) => classificationFor(attempt).providerUnavailable === true)) {
      excluded.push({ modelId, reason: 'provider_unavailable' });
      continue;
    }

    const insufficientFixture = requiredFixtureIds.map((fixtureId) => {
      const fixtureAttempts = modelAttempts.filter((attempt) => attempt.fixtureId === fixtureId);
      const primarySuccesses = fixtureAttempts
        .filter((attempt) => classificationFor(attempt).primarySuccess === true)
        .length;
      return { fixtureId, primarySuccesses };
    }).find(({ primarySuccesses }) => primarySuccesses < requiredRuns);

    if (!insufficientFixture) {
      advanced.push(modelId);
      continue;
    }

    excluded.push(requiredRuns === 1
      ? { modelId, reason: 'missing_primary_success', fixtureId: insufficientFixture.fixtureId }
      : {
        modelId,
        reason: 'insufficient_primary_successes',
        fixtureId: insufficientFixture.fixtureId,
        primarySuccesses: insufficientFixture.primarySuccesses,
        requiredRuns,
      });
  }

  return { advanced, excluded };
};

export const recommendWinner = ({ incumbent, candidate, qualityNoiseFloor } = {}) => {
  if (!completeForRecommendation(incumbent) || !completeForRecommendation(candidate) || !isFiniteMetric(qualityNoiseFloor)) {
    return { decision: 'no-decision', reason: 'incomplete_metrics' };
  }
  if (!hasCompletedStage3Confirmation(incumbent) || !hasCompletedStage3Confirmation(candidate)) {
    return { decision: 'no-decision', reason: 'incomplete_stage_3_confirmation' };
  }
  if (!incumbent.qualityPassed || !incumbent.stage3Confirmation.qualityPassed) {
    return { decision: 'no-decision', reason: 'incumbent_failed_quality_gate' };
  }
  if (!incumbent.reliabilityPassed || !incumbent.stage3Confirmation.reliabilityPassed) {
    return { decision: 'no-decision', reason: 'incumbent_failed_reliability_gate' };
  }
  if (!candidate.qualityPassed || !candidate.stage3Confirmation.qualityPassed) {
    return { decision: 'incumbent', winner: incumbent.modelId, reason: 'candidate_failed_quality_gate' };
  }
  if (!candidate.reliabilityPassed || !candidate.stage3Confirmation.reliabilityPassed) {
    return { decision: 'incumbent', winner: incumbent.modelId, reason: 'candidate_failed_reliability_gate' };
  }

  const qualityDelta = candidate.qualityScore - incumbent.qualityScore;
  if (qualityDelta > qualityNoiseFloor) {
    return { decision: 'candidate', winner: candidate.modelId, reason: 'higher_quality' };
  }
  if (qualityDelta < -qualityNoiseFloor) {
    return { decision: 'incumbent', winner: incumbent.modelId, reason: 'higher_quality' };
  }

  const latencyImprovement = (incumbent.p95LatencyMs - candidate.p95LatencyMs) / incumbent.p95LatencyMs;
  const costImprovement = (incumbent.estimatedCostUsd - candidate.estimatedCostUsd) / incumbent.estimatedCostUsd;
  if (latencyImprovement >= 0.15 || costImprovement >= 0.20) {
    return { decision: 'candidate', winner: candidate.modelId, reason: 'quality_tie_with_material_efficiency_gain' };
  }

  return { decision: 'incumbent', winner: incumbent.modelId, reason: 'quality_tie_without_material_efficiency_gain' };
};
