import { describe, expect, it } from 'vitest';

import {
  aggregateGoldAttempts,
  buildGoldContractOptions,
  buildGoldEvaluationAttempts,
  classifyGoldResult,
  parseGoldEvaluatorOptions,
} from '../gold-evaluator-options.mjs';

const incumbentByFeature = {
  parse: 'google/gemini-2.5-flash-lite',
  match: 'google/gemini-2.5-flash',
  optimize: 'google/gemini-2.5-flash',
};

describe.each(Object.entries(incumbentByFeature))('%s gold evaluator options', (feature, defaultModelId) => {
  it('turns every explicit model repeat into a direct OpenRouter contract invocation', () => {
    const options = parseGoldEvaluatorOptions({
      feature,
      defaultModelId,
      argv: [
        '--models',
        'google/gemini-3.1-flash-lite,mistralai/mistral-small-3.2-24b-instruct',
        '--runs',
        '3',
      ],
    });

    const attempts = buildGoldEvaluationAttempts({
      feature,
      fixtureIds: ['fixture-en'],
      models: options.models,
      runs: options.runs,
    });

    expect(options).toMatchObject({
      mode: 'evaluation',
      models: [
        'google/gemini-3.1-flash-lite',
        'mistralai/mistral-small-3.2-24b-instruct',
      ],
      runs: 3,
      cachePolicy: { read: false, write: false },
    });
    expect(attempts).toHaveLength(6);
    expect(attempts.every((attempt) => (
      attempt.contractOptions.modelId === attempt.modelId
      && attempt.contractOptions.disableFallback === true
      && attempt.contractOptions.featureName === `benchmark.${feature}`
    ))).toBe(true);
  });

  it('uses the incumbent explicitly when runs are requested without a model list', () => {
    const options = parseGoldEvaluatorOptions({
      feature,
      defaultModelId,
      argv: ['--runs', '2'],
    });

    expect(options).toMatchObject({
      mode: 'evaluation',
      models: [defaultModelId],
      runs: 2,
      cachePolicy: { read: false, write: false },
    });
  });

  it('preserves production defaults and ordinary cache behavior for no-argument runs', () => {
    const options = parseGoldEvaluatorOptions({
      feature,
      defaultModelId,
      argv: [],
    });

    expect(options).toMatchObject({
      mode: 'production',
      models: [],
      runs: 1,
      cachePolicy: { read: true, write: true },
    });
    expect(buildGoldContractOptions({ feature, mode: options.mode })).toEqual({});
  });
});

describe('gold evaluator guardrails', () => {
  it('permits candidate cache writes only behind --update-cache and never reads a cache', () => {
    const options = parseGoldEvaluatorOptions({
      feature: 'parse',
      defaultModelId: 'google/gemini-2.5-flash-lite',
      argv: [
        '--models',
        'google/gemini-3.1-flash-lite',
        '--update-cache',
      ],
    });

    expect(options.cachePolicy).toEqual({ read: false, write: true });
  });

  it('rejects candidates outside the benchmark allowlist before execution', () => {
    expect(() => parseGoldEvaluatorOptions({
      feature: 'match',
      defaultModelId: 'google/gemini-2.5-flash',
      argv: ['--models', 'untrusted/not-approved'],
    })).toThrow(/unsupported benchmark model/i);
  });

  it('treats any failed required attempt as a feature failure', () => {
    const aggregate = aggregateGoldAttempts([
      {
        classification: {
          primarySuccess: true,
          fallbackUsed: false,
          schemaValid: true,
          malformedJson: false,
          timeout: false,
          providerUnavailable: false,
          cacheUsed: false,
          skipped: false,
        },
        latencyMs: 120,
        score: 0.94,
        qualityPassed: true,
      },
      {
        classification: {
          primarySuccess: false,
          fallbackUsed: false,
          schemaValid: false,
          malformedJson: false,
          timeout: false,
          providerUnavailable: false,
          cacheUsed: false,
          skipped: false,
        },
        latencyMs: 80,
        score: 0,
        qualityPassed: false,
      },
    ]);

    expect(aggregate.requiredFailure).toBe(true);
    expect(aggregate.outcomeSummary).toMatchObject({
      attempts: 2,
      primarySuccesses: 1,
      successes: 1,
      failures: 1,
      schemaValid: 1,
      requiredFailures: 1,
      qualityFailures: 1,
    });
    expect(aggregate.latencies).toEqual([120, 80]);
    expect(aggregate.meanScore).toBe(0.47);
  });

  it.each([
    [{ name: 'TimeoutError', status: 504 }, 'timeout'],
    [{ code: 'AI_CONTRACT_JSON_PARSE_FAILED', status: 502 }, 'malformed_json'],
    [{ code: 'AI_CONTRACT_VALIDATION_FAILED', status: 502 }, 'schema_invalid'],
    [{ status: 503 }, 'provider_unavailable'],
    [{ code: 'AI_CONTRACT_ERROR', status: 400 }, 'contract_error'],
  ])('classifies direct provider failures with a durable reason', (error, expectedReason) => {
    const classification = classifyGoldResult({ error });

    expect(classification).toMatchObject({
      provider: 'openrouter',
      primarySuccess: false,
      schemaValid: false,
    });
    expect(classification.failureReasons).toContain(expectedReason);
  });

  it('classifies a validated direct result as a primary success', () => {
    expect(classifyGoldResult({ schemaValid: true })).toMatchObject({
      provider: 'openrouter',
      primarySuccess: true,
      schemaValid: true,
      failureReasons: [],
    });
  });
});
