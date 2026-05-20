/**
 * Migrates old storage keys to current "watheq:" keys.
 * Old keys are left in place so users can safely roll back to older builds.
 */
const MIGRATION_FLAG = 'watheq:migrationComplete';
const OLD_PREFIX = 'airo:';
const NEW_PREFIX = 'watheq:';

const prefixedKeysToMigrate = [
  'lastActiveTab',
  'resumeData',
  'lastJobDescription',
  'landingSeen',
  'previewQuotaUsed',
  'bulkAnalysis',
  'coverLetter',
  'interviewQuestions',
  'theme',
  'beta_access',
];

const keyAliases: Record<string, string[]> = {
  'watheq:bulkAnalysis': ['airo:bulkAnalysis'],
  'watheq:coverLetter': ['airo:coverLetter'],
  'watheq:lastJobDescription': ['airo:lastJobDescription'],
  'watheq:workflow-panel-last-step': ['workflow-panel-last-step'],
  'watheq:workflow-panel-minimized': ['workflow-panel-minimized'],
  'watheq:workflow-panel-position': ['workflow-panel-position'],
};

const getAliasesForKey = (key: string): string[] => keyAliases[key] ?? [];

export function getCompatibleStorageItem(key: string): string | null {
  const currentValue = localStorage.getItem(key);
  if (currentValue !== null) {
    return currentValue;
  }

  for (const oldKey of getAliasesForKey(key)) {
    const oldValue = localStorage.getItem(oldKey);
    if (oldValue !== null) {
      try {
        localStorage.setItem(key, oldValue);
      } catch (error) {
        console.warn(`[Storage Migration] Failed to copy ${oldKey} to ${key}:`, error);
      }
      return oldValue;
    }
  }

  return null;
}

export function setCompatibleStorageItem(key: string, value: string): void {
  localStorage.setItem(key, value);
}

export function removeCompatibleStorageItem(key: string): void {
  localStorage.removeItem(key);
  getAliasesForKey(key).forEach((oldKey) => {
    localStorage.removeItem(oldKey);
  });
}

export function migrateStorageKeys(): void {
  prefixedKeysToMigrate.forEach(key => {
    const oldKey = `${OLD_PREFIX}${key}`;
    const newKey = `${NEW_PREFIX}${key}`;

    try {
      const oldValue = localStorage.getItem(oldKey);

      if (oldValue !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, oldValue);
      }
    } catch (error) {
      console.error(`[Storage Migration] Failed to migrate ${oldKey}:`, error);
    }
  });

  Object.entries(keyAliases).forEach(([newKey, oldKeys]) => {
    oldKeys.forEach((oldKey) => {
      try {
        const oldValue = localStorage.getItem(oldKey);
        if (oldValue !== null && localStorage.getItem(newKey) === null) {
          localStorage.setItem(newKey, oldValue);
        }
      } catch (error) {
        console.error(`[Storage Migration] Failed to migrate ${oldKey}:`, error);
      }
    });
  });

  localStorage.setItem(MIGRATION_FLAG, 'true');
}
