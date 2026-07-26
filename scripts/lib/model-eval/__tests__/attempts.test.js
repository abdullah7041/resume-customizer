import { describe, expect, it } from 'vitest';

import { classifyAttempt, isConfirmationFailure } from '../attempts.mjs';
import { parseEvaluationArgs } from '../cli.mjs';

describe('classifyAttempt', () => {
  it('identifies a direct validated OpenRouter result as a primary success', () => {
    expect(classifyAttempt({
      provider: 'openrouter',
      schemaValid: true,
    })).toMatchObject({
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
    });
  });

  it('classifies a direct Gemini response as fallback without inspecting error text', () => {
    const result = classifyAttempt({
      provider: 'gemini',
      schemaValid: true,
      errorMessage: 'OpenRouter looked healthy',
    });

    expect(result).toMatchObject({
      provider: 'gemini',
      fallbackUsed: true,
      primarySuccess: false,
      failureReasons: ['fallback_used'],
    });
    expect(isConfirmationFailure(result)).toBe(true);
  });

  it.each([
    [{ provider: 'openrouter', schemaValid: false, failureReason: 'malformed_json' }, 'malformedJson', 'malformed_json'],
    [{ provider: 'openrouter', schemaValid: false, failureReason: 'timeout' }, 'timeout', 'timeout'],
    [{ provider: 'openrouter', schemaValid: false, failureReason: 'provider_unavailable' }, 'providerUnavailable', 'provider_unavailable'],
    [{ provider: 'cache', schemaValid: true }, 'cacheUsed', 'cache_used'],
    [{ provider: 'openrouter', schemaValid: false, skipped: true }, 'skipped', 'skipped'],
  ])('returns durable failure reasons for %s', (attempt, flag, reason) => {
    const result = classifyAttempt(attempt);

    expect(result[flag]).toBe(true);
    expect(result.primarySuccess).toBe(false);
    expect(result.failureReasons).toContain(reason);
    expect(isConfirmationFailure(result)).toBe(true);
  });

  it('treats a contract schema failure as a confirmation failure', () => {
    const result = classifyAttempt({ provider: 'openrouter', schemaValid: false });

    expect(result.failureReasons).toContain('schema_invalid');
    expect(isConfirmationFailure(result)).toBe(true);
  });

  it('rejects an unknown provider instead of guessing from an error message', () => {
    expect(() => classifyAttempt({ provider: 'unknown', schemaValid: true }))
      .toThrow(/provider/i);
  });
});

describe('parseEvaluationArgs', () => {
  it('combines legacy model flags with additive comma-separated models', () => {
    expect(parseEvaluationArgs([
      '--feature', 'match',
      '--baseline', 'google/incumbent',
      '--candidate', 'google/candidate',
      '--models', 'deepseek/extra, qwen/extra',
      '--runs', '3',
      '--fixture', 'arabic.json',
      '--stage', '2',
      '--update-cache',
      '--report-dir', 'C:/reports',
      '--selftest',
    ])).toEqual({
      feature: 'match',
      models: ['google/incumbent', 'google/candidate', 'deepseek/extra', 'qwen/extra'],
      baseline: 'google/incumbent',
      candidate: 'google/candidate',
      runs: 3,
      fixture: 'arabic.json',
      stage: 2,
      updateCache: true,
      reportDir: 'C:/reports',
      selftest: true,
    });
  });

  it.each([
    [['--models', 'google/model'], /--feature/i],
    [['--feature', 'match', '--runs', '0'], /--runs/i],
    [['--feature', 'match', '--stage', '4'], /--stage/i],
    [['--feature', 'match', '--models', 'google/model,'], /--models/i],
    [['--feature', 'match', '--feature', 'optimize'], /duplicate/i],
  ])('rejects missing, invalid, and duplicate values with usage', (argv, error) => {
    expect(() => parseEvaluationArgs(argv)).toThrow(error);
    expect(() => parseEvaluationArgs(argv)).toThrow(/usage:/i);
  });
});
