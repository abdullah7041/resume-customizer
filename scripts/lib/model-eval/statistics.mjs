const assertLatencySamples = (samples) => {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new TypeError('Latency samples must contain at least one value.');
  }

  if (samples.some((sample) => !Number.isFinite(sample))) {
    throw new TypeError('Latency samples must contain only finite numbers.');
  }
};

export const summarizeLatencies = (samples) => {
  assertLatencySamples(samples);

  const sorted = [...samples].sort((left, right) => left - right);
  const count = sorted.length;
  const middle = Math.floor(count / 2);
  const p50Ms = count % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
  const p95Index = Math.ceil(0.95 * count) - 1;
  const meanMs = samples.reduce((total, sample) => total + sample, 0) / count;

  return {
    count,
    minMs: sorted[0],
    p50Ms,
    p95Ms: sorted[p95Index],
    maxMs: sorted[count - 1],
    meanMs,
  };
};
