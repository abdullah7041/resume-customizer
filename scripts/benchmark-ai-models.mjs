/**
 * AI model benchmark harness.
 *
 * Authoritative direct-contract features:
 *   truth-check, cover-letter, interview
 *
 * Smoke-only features:
 *   match, optimize, clarification, metadata
 *
 * The module is import-safe. Provider clients are loaded only after CLI and model
 * validation succeeds and an attempt is about to run.
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import {
  dirname,
  join,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  APPROXIMATE_PRICING_SNAPSHOT_DATE,
  SUPPORTED_BENCHMARK_MODELS,
} from '../netlify/lib/model-registry.js';
import { classifyAttempt } from './lib/model-eval/attempts.mjs';
import { parseEvaluationArgs } from './lib/model-eval/cli.mjs';
import {
  FEATURE_CONTRACT_ALIASES,
  runContractAttempt as runDirectContractAttempt,
} from './lib/model-eval/contract-runners.mjs';
import {
  aggregateGoldAttempts,
  buildGoldScoreSummaries,
} from './lib/model-eval/gold-evaluator-options.mjs';
import {
  buildEvaluationStages,
  recommendWinner,
  requiredRunsForStage,
  selectAdvancingModels,
} from './lib/model-eval/matrix.mjs';
import {
  createEvaluationSession,
  writeEvaluationReport,
} from './lib/model-eval/reporting.mjs';
import { summarizeLatencies } from './lib/model-eval/statistics.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'benchmark-fixtures');
const DIRECT_CONTRACT_FIXTURE_DIRECTORIES = Object.freeze({
  'truth-check': join(__dirname, '..', 'eval', 'truth-check-fixtures'),
  'cover-letter': join(__dirname, '..', 'eval', 'cover-letter-fixtures'),
  interview: join(__dirname, '..', 'eval', 'interview-fixtures'),
});
const SMOKE_FIXTURE_PREFIXES = Object.freeze({
  clarification: 'clarification-',
  metadata: 'metadata-',
});
const GENERIC_FEATURES = new Set([
  'match',
  'optimize',
  'truth-check',
  'cover-letter',
  'interview',
  'clarification',
  'metadata',
]);
const AUTHORITATIVE_FEATURES = new Set([
  'truth-check',
  'cover-letter',
  'interview',
]);
const QUALITY_NOISE_FLOOR = 1;

const usageError = (message) => {
  const error = new Error(`${message}\nUsage: npm run benchmark:ai -- --feature <match|optimize|truth-check|cover-letter|interview|clarification|metadata> [--baseline <model> --candidate <model>] [--models <model,model>] [--runs <positive integer>] [--fixture <id>] [--report-dir <path>]`);
  error.code = 'EVALUATION_USAGE';
  return error;
};

const withLegacyDefaultFeature = (argv) => (
  argv.includes('--feature') ? [...argv] : ['--feature', 'optimize', ...argv]
);

export const parseBenchmarkCli = (argv = []) => {
  const parsed = parseEvaluationArgs(withLegacyDefaultFeature(argv));
  if (!GENERIC_FEATURES.has(parsed.feature)) {
    throw usageError(`Invalid --feature value "${parsed.feature}".`);
  }
  if (parsed.models.length === 0) {
    throw usageError('At least one model is required through --baseline/--candidate or --models.');
  }

  const unsupported = parsed.models.filter((modelId) => (
    !SUPPORTED_BENCHMARK_MODELS.includes(modelId)
  ));
  if (unsupported.length > 0) {
    throw usageError(`Unsupported benchmark model: ${unsupported.join(', ')}`);
  }

  const smokeOnly = !AUTHORITATIVE_FEATURES.has(parsed.feature);
  if (parsed.stage != null) {
    if (smokeOnly) {
      throw usageError('Smoke-only features cannot run model-selection stages.');
    }
    const requiredRuns = requiredRunsForStage(parsed.stage);
    if (parsed.runs !== requiredRuns) {
      throw usageError(`Stage ${parsed.stage} requires exactly ${requiredRuns} runs per fixture.`);
    }
    if (parsed.fixture) {
      throw usageError('Staged evaluation requires its complete stage fixture set; --fixture is not allowed.');
    }
    if (parsed.stage === 0 && parsed.models.length !== 1) {
      throw usageError('Stage 0 requires exactly one incumbent model.');
    }
    if (parsed.stage === 3 && parsed.models.length !== 2) {
      throw usageError('Stage 3 requires exactly the incumbent and one candidate model.');
    }
  }

  return {
    ...parsed,
    smokeOnly,
    selectionEligible: !smokeOnly,
    evaluationMode: smokeOnly ? 'smoke_only' : 'authoritative',
    disableFallback: true,
  };
};

const fixtureIdFor = (fixture) => (
  fixture?.id
  || fixture?._file
  || fixture?.name
  || 'unknown_fixture'
);

const fixtureMatches = (fixture, filter) => (
  !filter
  || fixture?._file === filter
  || fixture?.id === filter
  || fixture?.name === filter
);

export const loadBenchmarkFixtures = ({ feature, fixture, fixturesDir } = {}) => {
  const featureFixtureDirectory = DIRECT_CONTRACT_FIXTURE_DIRECTORIES[feature];
  const smokeFixturePrefix = SMOKE_FIXTURE_PREFIXES[feature];
  const resolvedFixturesDir = fixturesDir ?? featureFixtureDirectory ?? FIXTURES_DIR;
  const requireStableId = Boolean(featureFixtureDirectory || smokeFixturePrefix);
  if (!existsSync(resolvedFixturesDir)) {
    throw new Error(`Benchmark fixture directory does not exist: ${resolvedFixturesDir}`);
  }

  const fixtures = readdirSync(resolvedFixturesDir)
    .filter((filename) => (
      filename.endsWith('.json')
      && (!smokeFixturePrefix || filename.startsWith(smokeFixturePrefix))
    ))
    .sort()
    .map((filename) => ({
      ...JSON.parse(readFileSync(join(resolvedFixturesDir, filename), 'utf8')),
      _file: filename,
    }))
    .filter((loadedFixture) => (
      !fixture
      || (requireStableId
        ? loadedFixture.id === fixture
        : fixtureMatches(loadedFixture, fixture))
    ));

  if (fixtures.length === 0) {
    throw new Error(fixture
      ? `No benchmark fixture matched "${fixture}".`
      : 'No benchmark fixtures found.');
  }
  return fixtures;
};

const looksLikeRealData = (text) => {
  if (typeof text !== 'string') return false;
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/u;
  return emailPattern.test(text)
    && !text.toLocaleLowerCase().includes('sample')
    && !text.toLocaleLowerCase().includes('example');
};

const metricTokens = (text) => (
  typeof text === 'string'
    ? text.toLocaleLowerCase().match(/\$\d+[,.]?\d*[kmb]?|\d+%|\d+\s*(?:million|billion|thousand)/gu) ?? []
    : []
);

const optimizeHallucinationFlags = (result, fixture) => {
  const resumeText = fixture.resumeText ?? '';
  const outputText = JSON.stringify(result);
  const resumeLower = resumeText.toLocaleLowerCase();
  const outputLower = outputText.toLocaleLowerCase();
  const flags = [];

  for (const credential of ['phd', 'master', 'mba', 'bachelor', 'aws certified', 'pmp', 'scrum']) {
    if (outputLower.includes(credential) && !resumeLower.includes(credential)) {
      flags.push('possible_invented_credential');
    }
  }

  const resumeMetrics = new Set(metricTokens(resumeText));
  for (const metric of metricTokens(outputText)) {
    if (!resumeMetrics.has(metric) && !outputLower.includes(`${metric} (verify)`)) {
      flags.push('possible_invented_metric');
    }
  }

  if (fixture.language === 'ar' && !/[\u0600-\u06FF]/u.test(outputText)) {
    flags.push('language_drift');
  }
  return [...new Set(flags)];
};

const failureReasonFor = (error) => {
  if (error?.name === 'TimeoutError' || error?.status === 504) return 'timeout';
  if (error?.name === 'SyntaxError' || error?.code === 'AI_CONTRACT_JSON_PARSE_FAILED') {
    return 'malformed_json';
  }
  if (error?.code === 'AI_CONTRACT_VALIDATION_FAILED') return 'schema_invalid';
  if ([401, 403, 404, 408, 429, 500, 502, 503].includes(error?.status)) {
    return 'provider_unavailable';
  }
  return 'contract_error';
};

const classifyFailure = (error) => {
  const classification = classifyAttempt({
    provider: 'openrouter',
    schemaValid: false,
    failureReason: failureReasonFor(error),
  });
  return {
    ...classification,
    failureReasons: [...new Set(classification.failureReasons)],
  };
};

export const runSmokeAttempt = async ({
  feature,
  fixture,
  modelId,
  run = 1,
  wrappers,
  now = Date.now,
} = {}) => {
  if (!['match', 'optimize'].includes(feature)) {
    throw new TypeError(`Feature "${feature}" is not a wrapper smoke feature.`);
  }
  const startedAt = now();
  try {
    const loadedWrappers = wrappers ?? await import('../netlify/lib/gemini-client.js');
    const contractOptions = {
      modelId,
      disableFallback: true,
      featureName: `benchmark.${feature}`,
    };
    const output = feature === 'match'
      ? await loadedWrappers.processMatchOnly(
        fixture.resumeText,
        fixture.jobDescription,
        fixture.language,
        contractOptions,
      )
      : await loadedWrappers.optimizeResume(
        fixture.resumeText,
        fixture.jobDescription,
        fixture.language,
        [],
        '',
        [],
        contractOptions,
      );
    const hallucinationFlags = feature === 'optimize'
      ? optimizeHallucinationFlags(output, fixture)
      : [];

    return {
      feature,
      contractId: null,
      fixtureId: fixtureIdFor(fixture),
      modelId,
      run,
      latencyMs: Math.max(0, now() - startedAt),
      outputLength: JSON.stringify(output).length,
      score: feature === 'match' ? output.score ?? null : output.match_score ?? null,
      qualityPassed: hallucinationFlags.length === 0,
      qualityFailureReasons: hallucinationFlags,
      approximateCostUsd: null,
      status: null,
      errorCode: null,
      classification: classifyAttempt({
        provider: 'openrouter',
        schemaValid: true,
        failureReason: null,
      }),
    };
  } catch (error) {
    return {
      feature,
      contractId: null,
      fixtureId: fixtureIdFor(fixture),
      modelId,
      run,
      latencyMs: Math.max(0, now() - startedAt),
      outputLength: null,
      score: null,
      qualityPassed: false,
      qualityFailureReasons: [],
      approximateCostUsd: null,
      status: Number.isInteger(error?.status) ? error.status : null,
      errorCode: typeof error?.code === 'string' ? error.code : null,
      classification: classifyFailure(error),
    };
  }
};

const unexpectedAttemptFailure = ({ feature, fixture, modelId, run, error }) => ({
  feature,
  contractId: FEATURE_CONTRACT_ALIASES[feature] ?? null,
  fixtureId: fixtureIdFor(fixture),
  modelId,
  run,
  latencyMs: 0,
  outputLength: null,
  score: null,
  qualityPassed: false,
  qualityFailureReasons: [],
  approximateCostUsd: null,
  status: Number.isInteger(error?.status) ? error.status : null,
  errorCode: typeof error?.code === 'string' ? error.code : null,
  classification: classifyFailure(error),
});

const selectedFixtures = (fixtures, filter) => {
  const selected = fixtures.filter((fixture) => fixtureMatches(fixture, filter));
  if (selected.length === 0) {
    throw new Error(filter
      ? `No benchmark fixture matched "${filter}".`
      : 'No benchmark fixtures found.');
  }
  return selected;
};

const buildStageContext = (options, fixtures) => {
  if (options.stage == null) return null;

  const englishFixture = fixtures.find((fixture) => fixture.language === 'en');
  const arabicFixture = fixtures.find((fixture) => fixture.language === 'ar');
  if (!englishFixture || !arabicFixture) {
    throw new Error('Staged evaluation requires at least one English and one Arabic fixture.');
  }

  const incumbent = options.baseline ?? options.models[0];
  const winner = options.candidate ?? options.models.at(-1);
  const eligibilityFixtureIds = [fixtureIdFor(englishFixture), fixtureIdFor(arabicFixture)];
  const fullFixtureIds = fixtures.map(fixtureIdFor);
  const stages = buildEvaluationStages({
    incumbent,
    candidates: options.models.filter((modelId) => modelId !== incumbent),
    eligibilityFixtureIds,
    fullFixtureIds,
    winner,
  });
  const definition = stages.find((stage) => stage.stage === options.stage);
  const requiredFixtureIds = new Set(definition.fixtureIds);

  return {
    definition,
    fixtures: fixtures.filter((fixture) => requiredFixtureIds.has(fixtureIdFor(fixture))),
  };
};

const buildSelectionModelSummary = ({ modelId, attempts, advanced, stage }) => {
  const modelAttempts = attempts.filter((attempt) => attempt.modelId === modelId);
  const scores = modelAttempts.map((attempt) => attempt.score).filter(Number.isFinite);
  const latencies = modelAttempts.map((attempt) => attempt.latencyMs).filter(Number.isFinite);
  const allCostsKnown = modelAttempts.length > 0
    && modelAttempts.every((attempt) => Number.isFinite(attempt.approximateCostUsd));
  const qualityPassed = modelAttempts.length > 0
    && modelAttempts.every((attempt) => attempt.qualityPassed === true);
  const reliabilityPassed = advanced.includes(modelId);
  const summary = {
    modelId,
    qualityPassed,
    reliabilityPassed,
    qualityScore: scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : null,
    p95LatencyMs: latencies.length > 0 ? summarizeLatencies(latencies).p95Ms : null,
    estimatedCostUsd: allCostsKnown
      ? Number(modelAttempts.reduce((sum, attempt) => sum + attempt.approximateCostUsd, 0).toFixed(6))
      : null,
  };
  if (stage === 3) {
    summary.stage3Confirmation = {
      stage: 3,
      completed: reliabilityPassed,
      qualityPassed,
      reliabilityPassed,
    };
  }
  return summary;
};

const buildSelection = ({ options, stageContext, attempts }) => {
  if (options.smokeOnly) {
    return { eligible: false, reason: 'smoke_only_feature' };
  }
  if (!stageContext) {
    return { eligible: false, reason: 'stage_not_requested' };
  }

  const { definition } = stageContext;
  const advancement = selectAdvancingModels({
    stage: definition.stage,
    modelIds: definition.models,
    requiredFixtureIds: definition.fixtureIds,
    attempts,
  });
  const modelSummaries = definition.models.map((modelId) => buildSelectionModelSummary({
    modelId,
    attempts,
    advanced: advancement.advanced,
    stage: definition.stage,
  }));
  const recommendation = definition.stage === 3
    ? recommendWinner({
      incumbent: modelSummaries[0],
      candidate: modelSummaries[1],
      qualityNoiseFloor: QUALITY_NOISE_FLOOR,
    })
    : null;

  return {
    eligible: true,
    stage: definition.stage,
    requiredRuns: definition.runs,
    qualityNoiseFloor: QUALITY_NOISE_FLOOR,
    advanced: advancement.advanced,
    excluded: advancement.excluded,
    modelSummaries,
    recommendation,
  };
};

export const executeBenchmark = async (options, dependencies = {}) => {
  const logger = dependencies.logger ?? console;
  const loadedFixtures = selectedFixtures(
    dependencies.fixtures ?? loadBenchmarkFixtures(options),
    options.fixture,
  );
  const stageContext = buildStageContext(options, loadedFixtures);
  const fixtures = stageContext?.fixtures ?? loadedFixtures;
  const modelIds = stageContext?.definition.models ?? options.models;
  const directRunner = dependencies.runContractAttempt ?? runDirectContractAttempt;
  const smokeRunner = dependencies.runSmokeAttempt ?? runSmokeAttempt;
  const createSession = dependencies.createSession ?? createEvaluationSession;
  const writeReport = dependencies.writeReport ?? writeEvaluationReport;
  const attempts = [];

  logger.log(`[Benchmark] Feature: ${options.feature}`);
  logger.log(options.smokeOnly
    ? '[Benchmark] Mode: SMOKE ONLY — not eligible for model selection'
    : '[Benchmark] Mode: AUTHORITATIVE direct-contract evaluation');
  logger.log(`[Benchmark] Models: ${modelIds.join(', ')}`);
  logger.log(`[Benchmark] Runs per fixture: ${options.runs}`);

  for (const fixture of fixtures) {
    if (looksLikeRealData(fixture.resumeText) || looksLikeRealData(fixture.jobDescription)) {
      logger.warn(`[Benchmark] WARNING: Fixture "${fixtureIdFor(fixture)}" may contain real personal data.`);
    }
  }

  for (const fixture of fixtures) {
    for (const modelId of modelIds) {
      for (let run = 1; run <= options.runs; run += 1) {
        const attemptInput = {
          feature: options.feature,
          fixture,
          modelId,
          run,
        };
        let attempt;
        try {
          attempt = Object.hasOwn(FEATURE_CONTRACT_ALIASES, options.feature)
            ? await directRunner(attemptInput)
            : await smokeRunner(attemptInput);
        } catch (error) {
          attempt = unexpectedAttemptFailure({ ...attemptInput, error });
        }
        attempts.push(attempt);
        logger.log(
          `[Benchmark] ${attempt.fixtureId} model=${modelId} run=${run} primarySuccess=${attempt.classification?.primarySuccess === true} qualityPassed=${attempt.qualityPassed === true} latency=${attempt.latencyMs}ms`,
        );
      }
    }
  }

  const aggregate = aggregateGoldAttempts(attempts);
  const qualityFailures = attempts.filter((attempt) => attempt.qualityPassed !== true).length;
  const requiredFailure = aggregate.requiredFailure || qualityFailures > 0;
  const outcomeSummary = {
    ...aggregate.outcomeSummary,
    qualityFailures,
    requiredFailures: attempts.filter((attempt) => (
      attempt.classification?.primarySuccess !== true || attempt.qualityPassed !== true
    )).length,
  };
  const scoreSummaries = buildGoldScoreSummaries(attempts);
  const selection = buildSelection({ options, stageContext, attempts });
  const session = createSession({
    feature: options.feature,
    reportDir: options.reportDir ?? undefined,
  });
  const reportPaths = writeReport(session, {
    models: modelIds,
    providers: [...new Set(attempts.map((attempt) => attempt.classification?.provider).filter(Boolean))],
    fixtureIds: fixtures.map(fixtureIdFor),
    options: {
      runs: options.runs,
      fixture: options.fixture,
      stage: options.stage,
      updateCache: false,
      selftest: false,
      disableFallback: true,
      reportDir: options.reportDir,
      smokeOnly: options.smokeOnly,
      evaluationMode: options.evaluationMode,
    },
    outcomeSummary,
    scoreSummaries,
    selection,
    latencies: aggregate.latencies,
    approximateCostUsd: aggregate.approximateCostUsd,
    pricingSnapshotTimestamp: APPROXIMATE_PRICING_SNAPSHOT_DATE,
  });

  logger.log(`[Benchmark] Report written to: ${reportPaths.jsonPath}`);
  if (requiredFailure) {
    logger.error(`[Benchmark] FAIL: ${outcomeSummary.requiredFailures} required attempt(s) failed.`);
  }

  return {
    exitCode: requiredFailure || (selection.eligible && selection.excluded.length > 0) ? 1 : 0,
    attempts,
    outcomeSummary,
    scoreSummaries,
    selection,
    reportPaths,
  };
};

export const main = async (argv = process.argv.slice(2), dependencies = {}) => {
  const logger = dependencies.logger ?? console;
  try {
    const options = parseBenchmarkCli(argv);
    const result = await executeBenchmark(options, dependencies);
    return result.exitCode;
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
};

const executedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const modulePath = resolve(fileURLToPath(import.meta.url));
if (executedPath === modulePath) {
  main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
