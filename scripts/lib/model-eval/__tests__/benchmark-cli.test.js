import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let benchmark;
let fetchSpy;

const directSuccess = ({ feature, fixture, modelId, run }) => ({
  feature,
  contractId: 'resume_truth_check',
  fixtureId: fixture.id ?? fixture._file,
  modelId,
  run,
  latencyMs: 10,
  score: 100,
  qualityPassed: true,
  classification: {
    provider: 'openrouter',
    fallbackUsed: false,
    schemaValid: true,
    malformedJson: false,
    timeout: false,
    providerUnavailable: false,
    cacheUsed: false,
    skipped: false,
    primarySuccess: true,
    failureReasons: [],
  },
});

beforeAll(async () => {
  fetchSpy = vi.fn(() => {
    throw new Error('The benchmark must not fetch during import or CLI validation.');
  });
  vi.stubGlobal('fetch', fetchSpy);
  vi.stubEnv('OPENROUTER_API_KEY', '');
  vi.stubEnv('GEMINI_API_KEY', '');
  benchmark = await import('../../../benchmark-ai-models.mjs?test-import-safe');
});

afterAll(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('benchmark module and CLI validation', () => {
  it('does not make a network request when imported', () => {
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('preserves legacy baseline/candidate CLI while defaulting the legacy feature to optimize', () => {
    const parsed = benchmark.parseBenchmarkCli([
      '--baseline', 'google/gemini-2.5-flash',
      '--candidate', 'google/gemini-3.1-flash-lite',
    ]);

    expect(parsed).toMatchObject({
      feature: 'optimize',
      baseline: 'google/gemini-2.5-flash',
      candidate: 'google/gemini-3.1-flash-lite',
      models: [
        'google/gemini-2.5-flash',
        'google/gemini-3.1-flash-lite',
      ],
      runs: 1,
      smokeOnly: true,
      evaluationMode: 'smoke_only',
    });
  });

  it('accepts additive models and repeated runs for an authoritative contract feature', () => {
    const parsed = benchmark.parseBenchmarkCli([
      '--feature', 'truth-check',
      '--models', 'google/gemini-2.5-flash,google/gemini-3.1-flash-lite',
      '--runs', '3',
    ]);

    expect(parsed).toMatchObject({
      feature: 'truth-check',
      models: [
        'google/gemini-2.5-flash',
        'google/gemini-3.1-flash-lite',
      ],
      runs: 3,
      smokeOnly: false,
      evaluationMode: 'authoritative',
    });
  });

  it('rejects a stage-3 label when the five-run confirmation requirement is not met', () => {
    expect(() => benchmark.parseBenchmarkCli([
      '--feature', 'truth-check',
      '--models', 'google/gemini-2.5-flash,google/gemini-3.1-flash-lite',
      '--stage', '3',
      '--runs', '1',
    ])).toThrow('Stage 3 requires exactly 5 runs per fixture');
  });

  it('rejects staged winner selection for smoke-only features', () => {
    expect(() => benchmark.parseBenchmarkCli([
      '--feature', 'clarification',
      '--models', 'google/gemini-2.5-flash,google/gemini-3.1-flash-lite',
      '--stage', '1',
    ])).toThrow('Smoke-only features cannot run model-selection stages');
  });

  it.each([
    [
      ['--feature', 'not-a-feature', '--models', 'google/gemini-2.5-flash'],
      'Invalid --feature value',
    ],
    [
      ['--feature', 'truth-check', '--models', 'unsupported/example-model'],
      'Unsupported benchmark model',
    ],
  ])('rejects invalid CLI before any attempt can reach fetch', async (argv, message) => {
    const runContractAttempt = vi.fn();
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const exitCode = await benchmark.main(argv, { logger, runContractAttempt });

    expect(exitCode).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(message));
    expect(runContractAttempt).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('feature-specific benchmark fixture loading', () => {
  it.each([
    ['truth-check', 'truth-check-en-inflated-metric'],
    ['cover-letter', 'cover-letter-en-operations-positive'],
    ['interview', 'interview-en-operations-positive'],
  ])('loads the %s direct-contract corpus by stable fixture ID', (feature, fixtureId) => {
    const selected = benchmark.loadBenchmarkFixtures({ feature, fixture: fixtureId });
    const corpus = benchmark.loadBenchmarkFixtures({ feature });

    expect(selected).toHaveLength(1);
    expect(selected[0]).toMatchObject({
      id: fixtureId,
      feature,
    });
    expect(corpus).toHaveLength(8);
    expect(corpus.every((fixture) => fixture.feature === feature)).toBe(true);
  });

  it('does not accept a direct-contract fixture filename in place of its stable ID', () => {
    expect(() => benchmark.loadBenchmarkFixtures({
      feature: 'truth-check',
      fixture: 'truth-check-en-inflated-metric.json',
    })).toThrow('No benchmark fixture matched');
  });

  it.each([
    ['clarification', 'clarification-en-metrics-smoke'],
    ['metadata', 'metadata-en-explicit-smoke'],
  ])('routes %s only to its dedicated bilingual smoke fixtures', (feature, fixtureId) => {
    const corpus = benchmark.loadBenchmarkFixtures({ feature });
    const selected = benchmark.loadBenchmarkFixtures({ feature, fixture: fixtureId });

    expect(corpus).toHaveLength(2);
    expect(corpus.map((fixture) => fixture.language).sort()).toEqual(['ar', 'en']);
    expect(corpus.every((fixture) => fixture.feature === feature)).toBe(true);
    expect(selected).toHaveLength(1);
    expect(selected[0].id).toBe(fixtureId);
  });

  it.each([
    ['clarification', 'clarification-en-metrics-smoke.json'],
    ['metadata', 'metadata-en-explicit-smoke.json'],
  ])('requires a stable fixture ID when filtering %s smoke fixtures', (feature, filename) => {
    expect(() => benchmark.loadBenchmarkFixtures({
      feature,
      fixture: filename,
    })).toThrow('No benchmark fixture matched');
  });
});

describe('benchmark matrix execution and reporting', () => {
  it.each([
    ['match', 'processMatchOnly', { score: 72 }, 72],
    ['optimize', 'optimizeResume', { match_score: 74, bullet_improvements: [] }, 74],
  ])('keeps %s wrapper execution smoke-only while disabling provider fallback', async (
    feature,
    wrapperName,
    output,
    score,
  ) => {
    const wrappers = {
      processMatchOnly: vi.fn(),
      optimizeResume: vi.fn(),
    };
    wrappers[wrapperName].mockResolvedValue(output);
    const smokeFixture = {
      _file: 'smoke.json',
      resumeText: 'Synthetic resume',
      jobDescription: 'Synthetic job',
      language: 'en',
    };

    const result = await benchmark.runSmokeAttempt({
      feature,
      fixture: smokeFixture,
      modelId: 'google/gemini-3.1-flash-lite',
      run: 2,
      wrappers,
      now: (() => {
        const times = [10, 20];
        return () => times.shift();
      })(),
    });

    const expectedOptions = {
      modelId: 'google/gemini-3.1-flash-lite',
      disableFallback: true,
      featureName: `benchmark.${feature}`,
    };
    if (feature === 'match') {
      expect(wrappers.processMatchOnly).toHaveBeenCalledWith(
        smokeFixture.resumeText,
        smokeFixture.jobDescription,
        'en',
        expectedOptions,
      );
    } else {
      expect(wrappers.optimizeResume).toHaveBeenCalledWith(
        smokeFixture.resumeText,
        smokeFixture.jobDescription,
        'en',
        [],
        '',
        [],
        expectedOptions,
      );
    }
    expect(result).toMatchObject({
      fixtureId: 'smoke.json',
      modelId: 'google/gemini-3.1-flash-lite',
      run: 2,
      latencyMs: 10,
      score,
      qualityPassed: true,
      classification: {
        primarySuccess: true,
        fallbackUsed: false,
      },
    });
    expect(result).not.toHaveProperty('output');
  });

  it('runs every model, fixture, and repeat before returning a failed status', async () => {
    const options = benchmark.parseBenchmarkCli([
      '--feature', 'truth-check',
      '--models', 'google/gemini-2.5-flash,google/gemini-3.1-flash-lite',
      '--runs', '2',
    ]);
    const fixtures = [
      { _file: 'one.json', resumeText: 'one', jobDescription: 'one', language: 'en' },
      { _file: 'two.json', resumeText: 'two', jobDescription: 'two', language: 'ar' },
    ];
    let attemptNumber = 0;
    const runContractAttempt = vi.fn(async (input) => {
      attemptNumber += 1;
      const result = directSuccess(input);
      if (attemptNumber === 2) {
        return {
          ...result,
          score: null,
          qualityPassed: false,
          classification: {
            ...result.classification,
            schemaValid: false,
            primarySuccess: false,
            failureReasons: ['schema_invalid'],
          },
        };
      }
      return result;
    });
    const writeReport = vi.fn(() => ({ jsonPath: 'safe-report.json' }));

    const result = await benchmark.executeBenchmark(options, {
      fixtures,
      runContractAttempt,
      writeReport,
      createSession: vi.fn(() => ({ feature: 'truth-check', directory: 'unused' })),
      logger: {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    });

    expect(runContractAttempt).toHaveBeenCalledTimes(8);
    expect(writeReport).toHaveBeenCalledTimes(1);
    expect(writeReport.mock.invocationCallOrder[0]).toBeGreaterThan(
      runContractAttempt.mock.invocationCallOrder.at(-1),
    );
    expect(result).toMatchObject({
      exitCode: 1,
      attempts: expect.any(Array),
      reportPaths: { jsonPath: 'safe-report.json' },
    });
    expect(result.attempts).toHaveLength(8);
  });

  it('uses the bilingual stage-1 fixture gate and reports only fully advancing models', async () => {
    const options = benchmark.parseBenchmarkCli([
      '--feature', 'truth-check',
      '--models', 'google/gemini-2.5-flash,google/gemini-3.1-flash-lite',
      '--stage', '1',
      '--runs', '1',
    ]);
    const fixtures = [
      { id: 'truth-en', _file: 'truth-en.json', resumeText: 'one', language: 'en' },
      { id: 'truth-ar', _file: 'truth-ar.json', resumeText: 'two', language: 'ar' },
      { id: 'truth-mixed', _file: 'truth-mixed.json', resumeText: 'three', language: 'mixed' },
    ];
    const runContractAttempt = vi.fn(async (input) => directSuccess(input));
    const writeReport = vi.fn(() => ({ jsonPath: 'safe-report.json' }));

    const result = await benchmark.executeBenchmark(options, {
      fixtures,
      runContractAttempt,
      writeReport,
      createSession: vi.fn(() => ({ feature: 'truth-check', directory: 'unused' })),
      logger: {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    });

    expect(runContractAttempt).toHaveBeenCalledTimes(4);
    expect(result.attempts.map((attempt) => attempt.fixtureId)).toEqual([
      'truth-en',
      'truth-en',
      'truth-ar',
      'truth-ar',
    ]);
    expect(result.selection).toMatchObject({
      eligible: true,
      stage: 1,
      requiredRuns: 1,
      advanced: [
        'google/gemini-2.5-flash',
        'google/gemini-3.1-flash-lite',
      ],
      excluded: [],
      recommendation: null,
    });
    expect(writeReport).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ selection: result.selection }),
    );
  });

  it('applies stage-3 quality, reliability, noise, and latency tie policy in the selection report', async () => {
    const incumbent = 'google/gemini-2.5-flash';
    const candidate = 'google/gemini-3.1-flash-lite';
    const options = benchmark.parseBenchmarkCli([
      '--feature', 'truth-check',
      '--models', `${incumbent},${candidate}`,
      '--stage', '3',
      '--runs', '5',
    ]);
    const fixtures = [
      { id: 'truth-en', _file: 'truth-en.json', resumeText: 'one', language: 'en' },
      { id: 'truth-ar', _file: 'truth-ar.json', resumeText: 'two', language: 'ar' },
    ];
    const runContractAttempt = vi.fn(async (input) => ({
      ...directSuccess(input),
      latencyMs: input.modelId === candidate ? 80 : 100,
      approximateCostUsd: null,
    }));
    const writeReport = vi.fn(() => ({ jsonPath: 'safe-report.json' }));

    const result = await benchmark.executeBenchmark(options, {
      fixtures,
      runContractAttempt,
      writeReport,
      createSession: vi.fn(() => ({ feature: 'truth-check', directory: 'unused' })),
      logger: {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.selection).toMatchObject({
      eligible: true,
      stage: 3,
      requiredRuns: 5,
      advanced: [incumbent, candidate],
      excluded: [],
      qualityNoiseFloor: 1,
      recommendation: {
        decision: 'candidate',
        winner: candidate,
        reason: 'quality_tie_with_material_efficiency_gain',
        costGateAvailable: false,
      },
    });
  });

  it('labels match as smoke-only in the persisted report metadata', async () => {
    const reportRoot = mkdtempSync(join(tmpdir(), 'watheq-benchmark-'));
    try {
      const options = benchmark.parseBenchmarkCli([
        '--feature', 'match',
        '--models', 'google/gemini-2.5-flash',
        '--report-dir', reportRoot,
      ]);
      const smokeAttempt = vi.fn(async ({ feature, fixture, modelId, run }) => ({
        ...directSuccess({ feature, fixture, modelId, run }),
        contractId: null,
      }));

      const result = await benchmark.executeBenchmark(options, {
        fixtures: [{
          _file: 'smoke.json',
          resumeText: 'Synthetic resume',
          jobDescription: 'Synthetic job',
          language: 'en',
        }],
        runSmokeAttempt: smokeAttempt,
        logger: {
          log: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
      });
      const report = JSON.parse(readFileSync(result.reportPaths.jsonPath, 'utf8'));

      expect(result.exitCode).toBe(0);
      expect(smokeAttempt).toHaveBeenCalledOnce();
      expect(report.options).toMatchObject({
        smokeOnly: true,
        evaluationMode: 'smoke_only',
        disableFallback: true,
      });
      expect(report.selection).toEqual({
        eligible: false,
        reason: 'smoke_only_feature',
      });
      expect(report.pricingSnapshotTimestamp).toBe('2026-07-26');
      expect(report.providers).toEqual(['openrouter']);
    } finally {
      rmSync(reportRoot, { recursive: true, force: true });
    }
  });
});
