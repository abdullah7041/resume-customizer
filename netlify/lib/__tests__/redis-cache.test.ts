import { describe, expect, it } from 'vitest';

import { buildOptimizeCacheKey } from '../redis-cache.js';

describe('buildOptimizeCacheKey', () => {
  const baseInput = {
    userScope: 'user-123',
    resumeText: ' Resume text ',
    jobText: ' Job text ',
    language: 'en',
    vulnerabilities: ['gap', 'job_hopping'],
    userClarifications: '',
    userHardStops: [],
  };

  it('is stable for equivalent optimize inputs and scoped by user', () => {
    expect(buildOptimizeCacheKey(baseInput)).toBe(buildOptimizeCacheKey({
      ...baseInput,
      vulnerabilities: ['job_hopping', 'gap'],
    }));

    expect(buildOptimizeCacheKey(baseInput)).not.toBe(buildOptimizeCacheKey({
      ...baseInput,
      userScope: 'user-456',
    }));
  });
});
