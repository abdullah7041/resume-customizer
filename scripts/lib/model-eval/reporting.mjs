import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { summarizeLatencies } from './statistics.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPORTS_DIRECTORY = resolve(__dirname, '..', '..', 'benchmark-reports');
const FORBIDDEN_KEYS = new Set([
  'resumetext',
  'resume',
  'jobdescription',
  'jobtext',
  'messages',
  'prompt',
  'systemprompt',
  'rawoutput',
  'rawresponse',
  'providerresponse',
  'response',
  'result',
  'output',
  'content',
  'usageevent',
  'usageevents',
]);

const isForbiddenKey = (key) => {
  const normalized = String(key).replace(/[^a-z0-9]/gi, '').toLowerCase();
  return FORBIDDEN_KEYS.has(normalized)
    || normalized.startsWith('resume')
    || normalized.startsWith('job')
    || normalized.startsWith('usageevent')
    || normalized.includes('apikey');
};

const sanitizeForReport = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeForReport);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !isForbiddenKey(key))
    .map(([key, nestedValue]) => [key, sanitizeForReport(nestedValue)]));
};

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
- Latency p50 / p95: ${report.latency ? `${report.latency.p50Ms}ms / ${report.latency.p95Ms}ms` : 'not recorded'}
- Approximate cost (USD): ${report.approximateCostUsd ?? 'unknown'}
- Pricing snapshot: ${report.pricingSnapshotTimestamp ?? 'unknown'}

## Outcome summary

\`\`\`json
${JSON.stringify(report.outcomeSummary, null, 2)}
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

  const fixtureIds = Array.isArray(input.fixtureIds) ? [...input.fixtureIds] : [];
  const report = sanitizeForReport({
    schemaVersion: 1,
    feature: session.feature,
    generatedAt: input.generatedAt ?? session.timestamp,
    models: Array.isArray(input.models) ? [...input.models] : [],
    fixtureIds,
    fixtureCount: fixtureIds.length,
    options: input.options ?? {},
    outcomeSummary: input.outcomeSummary ?? {},
    latency: Array.isArray(input.latencies) && input.latencies.length > 0
      ? summarizeLatencies(input.latencies)
      : null,
    approximateCostUsd: input.approximateCostUsd ?? null,
    pricingSnapshotTimestamp: input.pricingSnapshotTimestamp ?? null,
  });
  const manifest = {
    schemaVersion: report.schemaVersion,
    feature: report.feature,
    generatedAt: report.generatedAt,
    models: report.models,
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
