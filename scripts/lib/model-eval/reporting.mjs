import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { summarizeLatencies } from './statistics.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPORTS_DIRECTORY = resolve(__dirname, '..', '..', 'benchmark-reports');
const COMMAND_OPTION_FIELDS = new Set([
  'runs',
  'fixture',
  'stage',
  'updateCache',
  'selftest',
  'disableFallback',
  'smokeOnly',
  'evaluationMode',
  'reportDir',
]);
const OUTCOME_COUNT_FIELDS = new Set([
  'attempts',
  'totalAttempts',
  'primarySuccesses',
  'successes',
  'failures',
  'fallbackUsed',
  'schemaValid',
  'malformedJson',
  'timeout',
  'providerUnavailable',
  'cacheUsed',
  'skipped',
  'requiredFailures',
  'excluded',
  'availabilityFailures',
  'qualityFailures',
]);
const OUTCOME_CODE_FIELDS = new Set(['failureReason', 'exclusionReason']);
const MACHINE_CODE = /^[a-z][a-z0-9_]*$/;
const MACHINE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;
const PROVIDERS = new Set(['openrouter', 'gemini', 'cache']);
const SCORE_SUMMARY_COUNT_FIELDS = ['attempts', 'primarySuccesses', 'failures'];
const SCORE_SUMMARY_METRIC_FIELDS = [
  'meanScore',
  'minScore',
  'maxScore',
  'p50LatencyMs',
  'p95LatencyMs',
];

const sanitizeCommandOptions = (options) => {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return {};

  return Object.fromEntries(Object.entries(options).filter(([key, value]) => {
    if (!COMMAND_OPTION_FIELDS.has(key)) return false;
    if (key === 'runs' || key === 'stage') return Number.isInteger(value) && value >= 0;
    if (key === 'fixture' || key === 'reportDir') return typeof value === 'string';
    if (key === 'evaluationMode') return ['authoritative', 'smoke_only'].includes(value);
    return typeof value === 'boolean';
  }));
};

const sanitizeOutcomeSummary = (outcomeSummary) => {
  if (!outcomeSummary || typeof outcomeSummary !== 'object' || Array.isArray(outcomeSummary)) return {};

  return Object.fromEntries(Object.entries(outcomeSummary).flatMap(([key, value]) => {
    if (OUTCOME_COUNT_FIELDS.has(key) && (Number.isFinite(value) || typeof value === 'boolean')) {
      return [[key, value]];
    }
    if (OUTCOME_CODE_FIELDS.has(key) && typeof value === 'string' && MACHINE_CODE.test(value)) {
      return [[key, value]];
    }
    if (key === 'failureReasons' && Array.isArray(value) && value.every((reason) => (
      typeof reason === 'string' && MACHINE_CODE.test(reason)
    ))) {
      return [[key, [...value]]];
    }
    return [];
  }));
};

const sanitizeMachineIds = (values) => Array.isArray(values)
  ? values.filter((value) => typeof value === 'string' && MACHINE_ID.test(value))
  : [];

const sanitizeProviders = (values) => Array.isArray(values)
  ? [...new Set(values.filter((value) => PROVIDERS.has(value)))]
  : [];

const sanitizeScoreSummaries = (scoreSummaries) => Array.isArray(scoreSummaries)
  ? scoreSummaries.flatMap((summary) => {
    if (
      !summary
      || typeof summary !== 'object'
      || !MACHINE_ID.test(summary.modelId ?? '')
      || !MACHINE_ID.test(summary.fixtureId ?? '')
    ) {
      return [];
    }

    const sanitized = {
      modelId: summary.modelId,
      fixtureId: summary.fixtureId,
    };
    for (const field of SCORE_SUMMARY_COUNT_FIELDS) {
      if (Number.isInteger(summary[field]) && summary[field] >= 0) {
        sanitized[field] = summary[field];
      }
    }
    for (const field of SCORE_SUMMARY_METRIC_FIELDS) {
      if (Number.isFinite(summary[field]) && summary[field] >= 0) {
        sanitized[field] = summary[field];
      } else if (summary[field] === null) {
        sanitized[field] = null;
      }
    }
    sanitized.approximateCostUsd = Number.isFinite(summary.approximateCostUsd)
      && summary.approximateCostUsd >= 0
      ? summary.approximateCostUsd
      : null;
    return [sanitized];
  })
  : [];

const formatTimestamp = (timestamp) => {
  if (timestamp == null) {
    return new Date().toISOString().replace(/[-:.]/g, '');
  }
  if (typeof timestamp !== 'string' || !/^[A-Za-z0-9_-]+$/.test(timestamp)) {
    throw new TypeError('Report timestamp must contain only letters, numbers, underscores, or hyphens.');
  }
  return timestamp;
};

const assertFeature = (feature) => {
  if (typeof feature !== 'string' || !/^[a-z][a-z0-9-]*$/.test(feature)) {
    throw new TypeError('Report feature must be a lowercase machine-readable name.');
  }
};

const writeNewFile = (path, contents) => {
  writeFileSync(path, `${contents}\n`, { encoding: 'utf8', flag: 'wx' });
};

const buildMarkdown = (report) => `# Model evaluation: ${report.feature}

- Generated at: ${report.generatedAt}
- Fixtures: ${report.fixtureCount}
- Models: ${report.models.join(', ') || '(none)'}
- Providers: ${report.providers.join(', ') || '(none)'}
- Latency p50 / p95: ${report.latency ? `${report.latency.p50Ms}ms / ${report.latency.p95Ms}ms` : 'not recorded'}
- Approximate cost (USD): ${report.approximateCostUsd ?? 'unknown'}
- Pricing snapshot: ${report.pricingSnapshotTimestamp ?? 'unknown'}

## Outcome summary

\`\`\`json
${JSON.stringify(report.outcomeSummary, null, 2)}
\`\`\`

## Score summaries

\`\`\`json
${JSON.stringify(report.scoreSummaries, null, 2)}
\`\`\`
`;

export const createEvaluationSession = ({ feature, timestamp, reportDir } = {}) => {
  assertFeature(feature);
  const resolvedReportDir = resolve(reportDir ?? DEFAULT_REPORTS_DIRECTORY);
  const resolvedTimestamp = formatTimestamp(timestamp);
  const directory = resolve(resolvedReportDir, `${resolvedTimestamp}-${feature}`);
  const directoryRelativeToRoot = relative(resolvedReportDir, directory);

  if (!directoryRelativeToRoot || directoryRelativeToRoot.startsWith('..') || isAbsolute(directoryRelativeToRoot)) {
    throw new TypeError('Report directory must remain within the configured report root.');
  }

  mkdirSync(resolvedReportDir, { recursive: true });
  try {
    mkdirSync(directory);
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(`Evaluation report directory already exists: ${directory}`);
    }
    throw error;
  }

  return {
    feature,
    timestamp: resolvedTimestamp,
    directory,
    manifestPath: resolve(directory, 'manifest.json'),
    jsonPath: resolve(directory, `${feature}.json`),
    markdownPath: resolve(directory, `${feature}.md`),
  };
};

export const writeEvaluationReport = (session, input = {}) => {
  if (!session || typeof session !== 'object' || !session.directory || !session.feature) {
    throw new TypeError('A report session created by createEvaluationSession is required.');
  }

  const fixtureIds = sanitizeMachineIds(input.fixtureIds);
  const report = {
    schemaVersion: 1,
    feature: session.feature,
    generatedAt: input.generatedAt ?? session.timestamp,
    models: sanitizeMachineIds(input.models),
    providers: sanitizeProviders(input.providers),
    fixtureIds,
    fixtureCount: fixtureIds.length,
    options: sanitizeCommandOptions(input.options),
    outcomeSummary: sanitizeOutcomeSummary(input.outcomeSummary),
    scoreSummaries: sanitizeScoreSummaries(input.scoreSummaries),
    latency: Array.isArray(input.latencies) && input.latencies.length > 0
      ? summarizeLatencies(input.latencies)
      : null,
    approximateCostUsd: Number.isFinite(input.approximateCostUsd) ? input.approximateCostUsd : null,
    pricingSnapshotTimestamp: typeof input.pricingSnapshotTimestamp === 'string'
      ? input.pricingSnapshotTimestamp
      : null,
  };
  const manifest = {
    schemaVersion: report.schemaVersion,
    feature: report.feature,
    generatedAt: report.generatedAt,
    models: report.models,
    providers: report.providers,
    fixtureIds: report.fixtureIds,
    fixtureCount: report.fixtureCount,
    options: report.options,
    pricingSnapshotTimestamp: report.pricingSnapshotTimestamp,
    files: [
      session.manifestPath.split(/[\\/]/).pop(),
      session.jsonPath.split(/[\\/]/).pop(),
      session.markdownPath.split(/[\\/]/).pop(),
    ],
  };

  writeNewFile(session.manifestPath, JSON.stringify(manifest, null, 2));
  writeNewFile(session.jsonPath, JSON.stringify(report, null, 2));
  writeNewFile(session.markdownPath, buildMarkdown(report));

  return {
    directory: session.directory,
    manifestPath: session.manifestPath,
    jsonPath: session.jsonPath,
    markdownPath: session.markdownPath,
  };
};
