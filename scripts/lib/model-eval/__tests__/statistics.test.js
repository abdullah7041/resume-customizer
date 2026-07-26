import { describe, expect, it } from 'vitest';

import { summarizeLatencies } from '../statistics.mjs';

describe('summarizeLatencies', () => {
  it('returns min, median p50, nearest-rank p95, max, and mean without mutating samples', () => {
    const samples = [40, 10, 30, 20];

    expect(summarizeLatencies(samples)).toEqual({
      count: 4,
      minMs: 10,
      p50Ms: 25,
      p95Ms: 40,
      maxMs: 40,
      meanMs: 25,
    });
    expect(samples).toEqual([40, 10, 30, 20]);
  });

  it('uses the nearest-rank index for p95 rather than interpolation', () => {
    const samples = Array.from({ length: 20 }, (_value, index) => index + 1);

    expect(summarizeLatencies(samples).p95Ms).toBe(19);
  });

  it('rejects empty and non-finite latency series', () => {
    expect(() => summarizeLatencies([])).toThrow(/at least one/i);
    expect(() => summarizeLatencies([10, Number.NaN])).toThrow(/finite/i);
    expect(() => summarizeLatencies([10, Infinity])).toThrow(/finite/i);
  });
});
