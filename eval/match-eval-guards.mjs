export function getMissingFixtureCaches(files, hasLiveApiKey, hasCacheForFile) {
  if (hasLiveApiKey) return [];
  return files.filter((file) => !hasCacheForFile(file));
}

const scoreBand = (score) => {
  if (score >= 80) return '80_plus';
  if (score >= 60) return '60_79';
  return 'below_60';
};

/**
 * Finds fixture groups whose identical requirements land in different product
 * rubric bands. It deliberately uses the published 0-59 / 60-79 / 80+ bands
 * rather than each fixture's broad acceptance range.
 */
export function getInvariantGroupFailures(runs) {
  const groups = new Map();
  for (const run of runs) {
    const group = run.expected?.invarianceGroup;
    if (!group || typeof run.actual?.score !== 'number' || !Number.isFinite(run.actual.score)) continue;
    const entries = groups.get(group) ?? [];
    entries.push(run);
    groups.set(group, entries);
  }

  return [...groups.entries()].flatMap(([group, entries]) => {
    const bands = new Set(entries.map((entry) => scoreBand(entry.actual.score)));
    return bands.size > 1
      ? [{ group, names: entries.map((entry) => entry.name), bands: [...bands] }]
      : [];
  });
}
