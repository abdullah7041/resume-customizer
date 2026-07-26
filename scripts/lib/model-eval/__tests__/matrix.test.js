import { describe, expect, it } from 'vitest';

import {
  buildEvaluationStages,
  recommendWinner,
  selectAdvancingModels,
} from '../matrix.mjs';

const incumbent = 'google/gemini-2.5-flash';
const candidate = 'google/gemini-3.5-flash';
const eligibilityFixtureIds = ['resume-en', 'resume-ar'];
const fullFixtureIds = ['resume-en', 'resume-ar', 'mixed', 'negative'];

const successfulAttempt = (modelId, fixtureId) => ({
  modelId,
  fixtureId,
  provider: 'openrouter',
  schemaValid: true,
});

const successfulAttempts = (modelId, fixtureId, count) => Array.from(
  { length: count },
  () => successfulAttempt(modelId, fixtureId),
);

describe('buildEvaluationStages', () => {
  it('defines the incumbent sanity, bilingual eligibility, screening, and fresh confirmation stages', () => {
    expect(buildEvaluationStages({
      incumbent,
      candidates: [candidate],
      eligibilityFixtureIds,
      fullFixtureIds,
      winner: candidate,
    })).toEqual([
      {
        stage: 0,
        name: 'incumbent-sanity',
        models: [incumbent],
        fixtureIds: fullFixtureIds,
        runs: 1,
        fresh: false,
      },
      {
        stage: 1,
        name: 'bilingual-eligibility',
        models: [incumbent, candidate],
        fixtureIds: eligibilityFixtureIds,
        runs: 1,
        fresh: false,
      },
      {
        stage: 2,
        name: 'full-suite-screening',
        models: [incumbent, candidate],
        fixtureIds: fullFixtureIds,
        runs: 3,
        fresh: false,
      },
      {
        stage: 3,
        name: 'fresh-confirmation',
        models: [incumbent, candidate],
        fixtureIds: fullFixtureIds,
        runs: 5,
        fresh: true,
      },
    ]);
  });
});

describe('selectAdvancingModels', () => {
  it('advances only models with a primary success for every required fixture', () => {
    const result = selectAdvancingModels({
      modelIds: [candidate],
      requiredFixtureIds: eligibilityFixtureIds,
      attempts: [successfulAttempt(candidate, 'resume-en')],
    });

    expect(result).toEqual({
      advanced: [],
      excluded: [{ modelId: candidate, reason: 'missing_primary_success', fixtureId: 'resume-ar' }],
    });
  });

  it('requires all three stage-2 primary attempts for every fixture before advancing', () => {
    const result = selectAdvancingModels({
      stage: 2,
      modelIds: [candidate],
      requiredFixtureIds: eligibilityFixtureIds,
      attempts: eligibilityFixtureIds.flatMap((fixtureId) => successfulAttempts(candidate, fixtureId, 1)),
    });

    expect(result).toEqual({
      advanced: [],
      excluded: [{
        modelId: candidate,
        reason: 'insufficient_primary_successes',
        fixtureId: 'resume-en',
        primarySuccesses: 1,
        requiredRuns: 3,
      }],
    });
  });

  it('requires all five stage-3 primary attempts for every fixture before advancing', () => {
    const result = selectAdvancingModels({
      stage: 3,
      modelIds: [candidate],
      requiredFixtureIds: eligibilityFixtureIds,
      attempts: eligibilityFixtureIds.flatMap((fixtureId) => successfulAttempts(candidate, fixtureId, 4)),
    });

    expect(result).toEqual({
      advanced: [],
      excluded: [{
        modelId: candidate,
        reason: 'insufficient_primary_successes',
        fixtureId: 'resume-en',
        primarySuccesses: 4,
        requiredRuns: 5,
      }],
    });
  });

  it('records an unavailable candidate as excluded instead of throwing', () => {
    const result = selectAdvancingModels({
      modelIds: [candidate],
      requiredFixtureIds: eligibilityFixtureIds,
      attempts: eligibilityFixtureIds.map((fixtureId) => ({
        modelId: candidate,
        fixtureId,
        provider: 'openrouter',
        schemaValid: false,
        failureReason: 'provider_unavailable',
      })),
    });

    expect(result).toEqual({
      advanced: [],
      excluded: [{ modelId: candidate, reason: 'provider_unavailable' }],
    });
  });

  it('does not trust a caller-supplied primarySuccess flag for a Gemini result', () => {
    const result = selectAdvancingModels({
      modelIds: [candidate],
      requiredFixtureIds: eligibilityFixtureIds,
      attempts: [
        {
          modelId: candidate,
          fixtureId: 'resume-en',
          provider: 'gemini',
          schemaValid: false,
          primarySuccess: true,
        },
        successfulAttempt(candidate, 'resume-ar'),
      ],
    });

    expect(result).toEqual({
      advanced: [],
      excluded: [{ modelId: candidate, reason: 'missing_primary_success', fixtureId: 'resume-en' }],
    });
  });

  it('preserves a provider-unavailable exclusion found after an earlier failed fixture', () => {
    const result = selectAdvancingModels({
      modelIds: [candidate],
      requiredFixtureIds: eligibilityFixtureIds,
      attempts: [
        {
          modelId: candidate,
          fixtureId: 'resume-en',
          provider: 'openrouter',
          schemaValid: false,
        },
        {
          modelId: candidate,
          fixtureId: 'resume-ar',
          provider: 'openrouter',
          schemaValid: false,
          failureReason: 'provider_unavailable',
        },
      ],
    });

    expect(result).toEqual({
      advanced: [],
      excluded: [{ modelId: candidate, reason: 'provider_unavailable' }],
    });
  });

  it('advances a candidate when all required fixtures have direct validated results', () => {
    const result = selectAdvancingModels({
      modelIds: [candidate],
      requiredFixtureIds: eligibilityFixtureIds,
      attempts: eligibilityFixtureIds.map((fixtureId) => successfulAttempt(candidate, fixtureId)),
    });

    expect(result).toEqual({ advanced: [candidate], excluded: [] });
  });
});

describe('recommendWinner', () => {
  const completeModel = (modelId, overrides = {}) => ({
    modelId,
    qualityPassed: true,
    reliabilityPassed: true,
    qualityScore: 90,
    p95LatencyMs: 1_000,
    estimatedCostUsd: 1,
    stage3Confirmation: {
      stage: 3,
      completed: true,
      qualityPassed: true,
      reliabilityPassed: true,
    },
    ...overrides,
  });

  it('refuses a candidate that fails a quality or reliability gate before comparing speed or cost', () => {
    expect(recommendWinner({
      incumbent: completeModel(incumbent),
      candidate: completeModel(candidate, { qualityPassed: false, p95LatencyMs: 500, estimatedCostUsd: 0.1 }),
      qualityNoiseFloor: 1,
    })).toEqual({
      decision: 'incumbent',
      winner: incumbent,
      reason: 'candidate_failed_quality_gate',
    });
  });

  it('retains the incumbent for an indistinguishable quality tie without a material efficiency gain', () => {
    expect(recommendWinner({
      incumbent: completeModel(incumbent),
      candidate: completeModel(candidate, { qualityScore: 90.5, p95LatencyMs: 900, estimatedCostUsd: 0.9 }),
      qualityNoiseFloor: 1,
    })).toEqual({
      decision: 'incumbent',
      winner: incumbent,
      reason: 'quality_tie_without_material_efficiency_gain',
    });
  });

  it('selects a tied candidate only when p95 latency or cost clears the replacement threshold', () => {
    expect(recommendWinner({
      incumbent: completeModel(incumbent),
      candidate: completeModel(candidate, { qualityScore: 90.5, p95LatencyMs: 850, estimatedCostUsd: 1 }),
      qualityNoiseFloor: 1,
    })).toEqual({
      decision: 'candidate',
      winner: candidate,
      reason: 'quality_tie_with_material_efficiency_gain',
    });
  });

  it('returns no-decision when a required gate or comparison metric is incomplete', () => {
    expect(recommendWinner({
      incumbent: completeModel(incumbent),
      candidate: completeModel(candidate, { estimatedCostUsd: null }),
      qualityNoiseFloor: 1,
    })).toEqual({ decision: 'no-decision', reason: 'incomplete_metrics' });
  });

  it.each(['incumbent', 'candidate'])('requires completed stage-3 confirmation evidence for the %s', (missingModel) => {
    const input = {
      incumbent: completeModel(incumbent),
      candidate: completeModel(candidate, { p95LatencyMs: 500, estimatedCostUsd: 0.1 }),
      qualityNoiseFloor: 1,
    };
    delete input[missingModel].stage3Confirmation;

    expect(recommendWinner(input)).toEqual({
      decision: 'no-decision',
      reason: 'incomplete_stage_3_confirmation',
    });
  });
});
