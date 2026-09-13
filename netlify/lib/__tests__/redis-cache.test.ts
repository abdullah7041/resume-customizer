import { describe, expect, it } from 'vitest';

import { buildCacheKey, buildOptimizeCacheKey } from '../redis-cache.js';

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

it("includes nested clarification answers in cache identity", () => {
 expect(buildCacheKey("clarify", {history: [{answer: "yes"}]})).not.toBe(buildCacheKey("clarify", {history: [{answer: "no"}]}));
 expect(buildCacheKey("clarify", {history: [{answer: "yes", id: "1"}]})).toBe(buildCacheKey("clarify", {history: [{id: "1", answer: "yes"}]}));
});
