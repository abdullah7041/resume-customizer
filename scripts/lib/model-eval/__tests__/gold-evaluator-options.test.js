import { describe, expect, it } from 'vitest';

import {
  aggregateGoldAttempts,
  buildGoldContractOptions,
  buildGoldEvaluationAttempts,
  buildGoldScoreSummaries,
  classifyGoldResult,
  parseGoldEvaluatorOptions,
  parseOptimizeGoldEvaluatorOptions,
  unwrapEvaluationResponse,
  validateOptimizeJudgeResult,
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
      && attempt.contractOptions.includeResponseMetadata === true
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
    expect(buildGoldContractOptions({ feature, mode: options.mode })).toEqual({
      disableFallback: true,
      includeResponseMetadata: true,
    });
  });
});

describe('gold evaluator guardrails', () => {
  it('pins disableFallback in production mode so the gold set never silently measures the Gemini fallback', () => {
    expect(buildGoldContractOptions({ feature: 'parse', mode: 'production' })).toEqual({
      disableFallback: true,
      includeResponseMetadata: true,
    });
  });

  it('still returns the full evaluation-mode option set including modelId and featureName', () => {
    expect(buildGoldContractOptions({
      feature: 'parse',
      mode: 'evaluation',
      modelId: 'google/gemini-2.5-flash-lite',
    })).toEqual({
      modelId: 'google/gemini-2.5-flash-lite',
      disableFallback: true,
      featureName: 'benchmark.parse',
      includeResponseMetadata: true,
    });
  });

  it('reports the actual serving provider when the caller supplies one, and defaults to openrouter otherwise', () => {
    expect(classifyGoldResult({ provider: 'gemini' })).toMatchObject({ provider: 'gemini' });
    expect(classifyGoldResult({})).toMatchObject({ provider: 'openrouter' });
  });

  it('rejects an empty attempts array rather than silently reporting zero required failures', () => {
    expect(() => aggregateGoldAttempts([])).toThrow(TypeError);
  });

  it('unwraps opt-in provider metadata and calculates cost without exposing raw usage', () => {
    const data = { score: 72 };
    expect(unwrapEvaluationResponse({
      response: {
        data,
        metadata: {
          provider: 'openrouter',
          modelId: 'google/gemini-3.1-flash-lite',
          tokenUsage: {
            promptTokens: 1000,
            completionTokens: 500,
            totalTokens: 1500,
            reasoningTokens: 0,
          },
        },
      },
      modelId: 'google/gemini-3.1-flash-lite',
    })).toEqual({
      value: data,
      approximateCostUsd: 0.001,
    });
  });

  it('keeps cost null when pricing or safe token metadata is unavailable', () => {
    expect(unwrapEvaluationResponse({
      response: {
        text: '{"ok":true}',
        metadata: {
          provider: 'openrouter',
          modelId: 'unknown/unpriced',
          tokenUsage: {
            promptTokens: null,
            completionTokens: 500,
          },
        },
      },
      modelId: 'unknown/unpriced',
    })).toEqual({
      value: '{"ok":true}',
      approximateCostUsd: null,
    });
  });

  it('does not report a partial cost total when any attempt lacks cost evidence', () => {
    const attempts = [
      {
        modelId: 'google/gemini-3.1-flash-lite',
        fixtureId: 'fixture-en',
        latencyMs: 10,
        score: 1,
        approximateCostUsd: 0.001,
        classification: { primarySuccess: true },
      },
      {
        modelId: 'google/gemini-3.1-flash-lite',
        fixtureId: 'fixture-en',
        latencyMs: 10,
        score: 1,
        approximateCostUsd: null,
        classification: { primarySuccess: true },
      },
    ];

    expect(aggregateGoldAttempts(attempts).approximateCostUsd).toBeNull();
    expect(buildGoldScoreSummaries(attempts)[0].approximateCostUsd).toBeNull();
  });

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

  it('builds auditable per-model and per-fixture score summaries', () => {
    const summaries = buildGoldScoreSummaries([
      {
        modelId: 'google/gemini-3.1-flash-lite',
        fixtureId: 'resume-en',
        latencyMs: 100,
        score: 0.8,
        approximateCostUsd: 0.01,
        classification: { primarySuccess: true },
      },
      {
        modelId: 'google/gemini-3.1-flash-lite',
        fixtureId: 'resume-en',
        latencyMs: 300,
        score: 1,
        approximateCostUsd: 0.02,
        classification: { primarySuccess: true },
      },
      {
        modelId: 'mistralai/mistral-small-3.2-24b-instruct',
        fixtureId: 'resume-en',
        latencyMs: 250,
        score: 0,
        classification: { primarySuccess: false },
      },
    ]);

    expect(summaries).toEqual([
      {
        modelId: 'google/gemini-3.1-flash-lite',
        fixtureId: 'resume-en',
        attempts: 2,
        primarySuccesses: 2,
        failures: 0,
        meanScore: 0.9,
        minScore: 0.8,
        maxScore: 1,
        p50LatencyMs: 200,
        p95LatencyMs: 300,
        approximateCostUsd: 0.03,
      },
      {
        modelId: 'mistralai/mistral-small-3.2-24b-instruct',
        fixtureId: 'resume-en',
        attempts: 1,
        primarySuccesses: 0,
        failures: 1,
        meanScore: 0,
        minScore: 0,
        maxScore: 0,
        p50LatencyMs: 250,
        p95LatencyMs: 250,
        approximateCostUsd: null,
      },
    ]);
  });
});

describe('optimize additive evaluator options', () => {
  it('preserves a legacy candidate when runs activate the shared matrix', () => {
    const options = parseOptimizeGoldEvaluatorOptions({
      defaultModelId: 'google/gemini-2.5-flash',
      argv: [
        '--candidate',
        'google/gemini-3.1-flash-lite',
        '--runs',
        '3',
        '--report-dir',
        'reports',
      ],
    });

    expect(options).toMatchObject({
      mode: 'evaluation',
      matrixRequested: true,
      models: [
        'google/gemini-2.5-flash',
        'google/gemini-3.1-flash-lite',
      ],
      runs: 3,
      reportDir: 'reports',
    });
  });

  it('combines legacy baseline and candidate with additive --models', () => {
    const options = parseOptimizeGoldEvaluatorOptions({
      defaultModelId: 'google/gemini-2.5-flash',
      argv: [
        '--baseline',
        'google/gemini-2.5-flash',
        '--candidate',
        'google/gemini-3.1-flash-lite',
        '--models',
        'mistralai/mistral-small-3.2-24b-instruct',
        '--stage',
        '2',
      ],
    });

    expect(options).toMatchObject({
      matrixRequested: true,
      models: [
        'google/gemini-2.5-flash',
        'google/gemini-3.1-flash-lite',
        'mistralai/mistral-small-3.2-24b-instruct',
      ],
      stage: 2,
    });
  });
});

describe('optimize judge completeness', () => {
  const completeEvaluation = (label) => ({
    label,
    specificity: 4,
    jd_alignment: 4,
    truthfulness: 5,
    readability: 4,
    notes: 'grounded',
  });

  it('fails a judge that omits an expected variant', () => {
    const validation = validateOptimizeJudgeResult({
      labelMap: { A: 'prod', B: 'candidate' },
      parsed: {
        evaluations: [completeEvaluation('A')],
        best_label: 'A',
        reasoning: 'Prod wins.',
      },
    });

    expect(validation.requiredFailure).toBe(true);
    expect(validation.failureReasons).toContain('missing_variant:candidate');
  });

  it.each([
    [{ truthfulness: undefined }, 'invalid_dimension:candidate:truthfulness'],
    [{ truthfulness: 6 }, 'invalid_dimension:candidate:truthfulness'],
    [{ readability: Number.NaN }, 'invalid_dimension:candidate:readability'],
  ])('fails a judge with a missing or out-of-range dimension', (override, expectedReason) => {
    const validation = validateOptimizeJudgeResult({
      labelMap: { A: 'prod', B: 'candidate' },
      parsed: {
        evaluations: [
          completeEvaluation('A'),
          { ...completeEvaluation('B'), ...override },
        ],
        best_label: 'A',
        reasoning: 'Prod wins.',
      },
    });

    expect(validation.requiredFailure).toBe(true);
    expect(validation.failureReasons).toContain(expectedReason);
  });

  it('accepts a judge only when every expected variant has four bounded dimensions', () => {
    const validation = validateOptimizeJudgeResult({
      labelMap: { A: 'prod', B: 'candidate' },
      parsed: {
        evaluations: [completeEvaluation('A'), completeEvaluation('B')],
        best_label: 'A',
        reasoning: 'Prod wins.',
      },
    });

    expect(validation).toMatchObject({
      requiredFailure: false,
      failureReasons: [],
      byVariant: {
        prod: {
          specificity: 4,
          jd_alignment: 4,
          truthfulness: 5,
          readability: 4,
        },
        candidate: {
          specificity: 4,
          jd_alignment: 4,
          truthfulness: 5,
          readability: 4,
        },
      },
    });
  });
});
