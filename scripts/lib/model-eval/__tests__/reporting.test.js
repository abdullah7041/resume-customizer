import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createEvaluationSession, writeEvaluationReport } from '../reporting.mjs';

const temporaryDirectories = [];

const createTempReportsDirectory = () => {
  const directory = mkdtempSync(join(tmpdir(), 'watheq-model-eval-'));
  temporaryDirectories.push(directory);
  return directory;
};

afterEach(() => {
  while (temporaryDirectories.length) {
    rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
  }
});

describe('writeEvaluationReport', () => {
  it('writes deterministic absolute paths and only sanitized evaluation metadata', () => {
    const reportDir = createTempReportsDirectory();
    const session = createEvaluationSession({
      feature: 'match',
      timestamp: '20260726T120000Z',
      reportDir,
    });

    const paths = writeEvaluationReport(session, {
      models: ['google/gemini-2.5-flash', 'google/gemini-3.5-flash-lite'],
      fixtureIds: ['fixture-en-001', 'fixture-ar-001'],
      options: {
        runs: 3,
        disableFallback: true,
        apiKey: 'secret-api-key',
        nested: { OPENROUTER_API_KEY: 'another-secret' },
      },
      outcomeSummary: { primarySuccesses: 5, failures: 1 },
      latencies: [100, 200, 300],
      approximateCostUsd: 0.0123,
      scoreSummaries: [{
        modelId: 'google/gemini-3.5-flash-lite',
        fixtureId: 'fixture-en-001',
        attempts: 3,
        primarySuccesses: 2,
        failures: 1,
        meanScore: 0.91,
        minScore: 0.84,
        maxScore: 0.98,
        p50LatencyMs: 200,
        p95LatencyMs: 300,
        approximateCostUsd: null,
        resumeText: 'private score-summary resume',
        rawOutput: 'private score-summary output',
      }],
      pricingSnapshotTimestamp: '2026-07-26T11:00:00.000Z',
      attempts: [{
        resumeText: 'private resume',
        jobDescription: 'private job description',
        messages: [{ role: 'user', content: 'private prompt' }],
        rawOutput: '{"private":true}',
        usageEvent: { payload: 'private telemetry' },
      }],
    });

    expect(paths).toEqual({
      directory: join(reportDir, '20260726T120000Z-match'),
      manifestPath: join(reportDir, '20260726T120000Z-match', 'manifest.json'),
      jsonPath: join(reportDir, '20260726T120000Z-match', 'match.json'),
      markdownPath: join(reportDir, '20260726T120000Z-match', 'match.md'),
    });
    expect(Object.values(paths).every((path) => path.startsWith(reportDir))).toBe(true);

    const contents = Object.values(paths)
      .filter((path) => path !== paths.directory)
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    const report = JSON.parse(readFileSync(paths.jsonPath, 'utf8'));

    expect(report).toMatchObject({
      models: ['google/gemini-2.5-flash', 'google/gemini-3.5-flash-lite'],
      fixtureIds: ['fixture-en-001', 'fixture-ar-001'],
      fixtureCount: 2,
      latency: { p50Ms: 200, p95Ms: 300 },
      approximateCostUsd: 0.0123,
      scoreSummaries: [{
        modelId: 'google/gemini-3.5-flash-lite',
        fixtureId: 'fixture-en-001',
        attempts: 3,
        primarySuccesses: 2,
        failures: 1,
        meanScore: 0.91,
        minScore: 0.84,
        maxScore: 0.98,
        p50LatencyMs: 200,
        p95LatencyMs: 300,
        approximateCostUsd: null,
      }],
      pricingSnapshotTimestamp: '2026-07-26T11:00:00.000Z',
    });
    expect(contents).not.toMatch(/private resume|private job description|private prompt|private telemetry|private score-summary resume|private score-summary output|secret-api-key|another-secret/);
    expect(contents).not.toMatch(/resumeText|jobDescription|messages|rawOutput|apiKey|OPENROUTER_API_KEY|usageEvent/);
  });

  it('creates the session directory and report files without overwriting an existing name', () => {
    const reportDir = createTempReportsDirectory();
    const session = createEvaluationSession({ feature: 'parse', timestamp: '20260726T120001Z', reportDir });

    writeEvaluationReport(session, { fixtureIds: ['fixture-1'], latencies: [42] });

    expect(() => createEvaluationSession({ feature: 'parse', timestamp: '20260726T120001Z', reportDir }))
      .toThrow(/already exists/i);
    expect(() => writeEvaluationReport(session, { fixtureIds: ['fixture-1'], latencies: [42] }))
      .toThrow(/already exists/i);
  });

  it('omits snake-case prompt, job, and usage-event payload variants', () => {
    const reportDir = createTempReportsDirectory();
    const session = createEvaluationSession({ feature: 'optimize', timestamp: '20260726T120002Z', reportDir });
    const paths = writeEvaluationReport(session, {
      outcomeSummary: {
        job_text: 'private job text',
        system_prompt: 'private system prompt',
        usage_event_payload: { secret: 'private usage event' },
      },
      fixtureIds: ['fixture-1'],
      latencies: [20],
    });

    const contents = readFileSync(paths.jsonPath, 'utf8');

    expect(contents).not.toMatch(/private job text|private system prompt|private usage event/);
    expect(contents).not.toMatch(/job_text|system_prompt|usage_event_payload/);
  });

  it('allows only command and outcome metadata instead of alias-named raw outputs or credentials', () => {
    const reportDir = createTempReportsDirectory();
    const session = createEvaluationSession({ feature: 'truth-check', timestamp: '20260726T120003Z', reportDir });
    const paths = writeEvaluationReport(session, {
      options: {
        runs: 3,
        disableFallback: true,
        authorization: 'Bearer private-credential',
        accessToken: 'private-access-token',
      },
      outcomeSummary: {
        primarySuccesses: 2,
        failures: 1,
        modelOutput: '{"raw":"private model output"}',
        authorization: 'private-outcome-credential',
        token: 'private-outcome-token',
      },
      fixtureIds: ['fixture-1'],
      latencies: [20],
    });

    const report = JSON.parse(readFileSync(paths.jsonPath, 'utf8'));
    const contents = Object.values(paths)
      .filter((path) => path !== paths.directory)
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');

    expect(report.options).toEqual({ runs: 3, disableFallback: true });
    expect(report.outcomeSummary).toEqual({ primarySuccesses: 2, failures: 1 });
    expect(contents).not.toMatch(/private-credential|private-access-token|private model output|private-outcome-credential|private-outcome-token/);
    expect(contents).not.toMatch(/authorization|accessToken|modelOutput|token/);
  });
});
