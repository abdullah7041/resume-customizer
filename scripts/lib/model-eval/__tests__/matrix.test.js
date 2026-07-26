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
});
