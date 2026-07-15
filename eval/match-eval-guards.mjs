export function getMissingFixtureCaches(files, hasLiveApiKey, hasCacheForFile) {
  if (hasLiveApiKey) return [];
  return files.filter((file) => !hasCacheForFile(file));
}
