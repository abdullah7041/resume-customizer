/**
 * Migrates old "airo:" storage keys to new "watheq:" keys
 * Runs once on app initialization to preserve user data
 */
export function migrateStorageKeys(): void {
  const MIGRATION_FLAG = 'watheq:migrationComplete';

  // Skip if already migrated
  if (localStorage.getItem(MIGRATION_FLAG)) {
    return;
  }

  const OLD_PREFIX = 'airo:';
  const NEW_PREFIX = 'watheq:';

  const keysToMigrate = [
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

  let migratedCount = 0;

  keysToMigrate.forEach(key => {
    const oldKey = `${OLD_PREFIX}${key}`;
    const newKey = `${NEW_PREFIX}${key}`;

    try {
      const oldValue = localStorage.getItem(oldKey);

      // Only migrate if old key exists and new key doesn't
      if (oldValue !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, oldValue);
        localStorage.removeItem(oldKey);
        migratedCount++;
        console.log(`[Storage Migration] ${oldKey} → ${newKey}`);
      }
    } catch (error) {
      console.error(`[Storage Migration] Failed to migrate ${oldKey}:`, error);
    }
  });

  // Mark migration as complete
  localStorage.setItem(MIGRATION_FLAG, 'true');

  if (migratedCount > 0) {
    console.log(`[Storage Migration] Completed: ${migratedCount} keys migrated`);
  }
}
