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

const classificationFor = (attempt) => {
  if (attempt && typeof attempt === 'object' && typeof attempt.primarySuccess === 'boolean') {
    return attempt;
  }
  return classifyAttempt(attempt);
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

export const selectAdvancingModels = ({ modelIds, requiredFixtureIds, attempts = [] } = {}) => {
  if (!Array.isArray(modelIds) || modelIds.some((modelId) => !isNonEmptyString(modelId))) {
    throw new TypeError('modelIds must contain non-empty model IDs.');
  }
  assertFixtureIds(requiredFixtureIds, 'requiredFixtureIds');
  if (!Array.isArray(attempts)) {
    throw new TypeError('attempts must be an array.');
  }

  const advanced = [];
  const excluded = [];

  for (const modelId of uniqueModelIds(modelIds)) {
    const modelAttempts = attempts.filter((attempt) => attempt?.modelId === modelId);
    const missingFixtureId = requiredFixtureIds.find((fixtureId) => !modelAttempts
      .filter((attempt) => attempt.fixtureId === fixtureId)
      .some((attempt) => classificationFor(attempt).primarySuccess === true));

    if (!missingFixtureId) {
      advanced.push(modelId);
      continue;
    }

    const missingFixtureAttempts = modelAttempts.filter((attempt) => attempt.fixtureId === missingFixtureId);
    const unavailable = missingFixtureAttempts.some((attempt) => classificationFor(attempt).providerUnavailable === true);
    excluded.push(unavailable
      ? { modelId, reason: 'provider_unavailable' }
      : { modelId, reason: 'missing_primary_success', fixtureId: missingFixtureId });
  }

  return { advanced, excluded };
};

export const recommendWinner = ({ incumbent, candidate, qualityNoiseFloor } = {}) => {
  if (!completeForRecommendation(incumbent) || !completeForRecommendation(candidate) || !isFiniteMetric(qualityNoiseFloor)) {
    return { decision: 'no-decision', reason: 'incomplete_metrics' };
  }
  if (!incumbent.qualityPassed) {
    return { decision: 'no-decision', reason: 'incumbent_failed_quality_gate' };
  }
  if (!incumbent.reliabilityPassed) {
    return { decision: 'no-decision', reason: 'incumbent_failed_reliability_gate' };
  }
  if (!candidate.qualityPassed) {
    return { decision: 'incumbent', winner: incumbent.modelId, reason: 'candidate_failed_quality_gate' };
  }
  if (!candidate.reliabilityPassed) {
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
