const OWNER_KEY = 'watheq:privateOwner';
export const PRIVATE_EPOCH_STORAGE_KEY = 'watheq:privateEpoch';
const SNAPSHOT_PREFIX = 'watheq:privateSession:';
const PRIVATE_KEYS = [
  'resume-storage', 'watheq:resumeData', 'airo:resumeData',
  'watheq:lastJobDescription', 'airo:lastJobDescription',
  'watheq:resumeTruthCheck', 'watheq:lastMatchAnalysis', 'watheq:hardStops', 'watheq:pasteDraft', 'watheq:jobSaveDraft',
  'watheq:vision2030Analysis', 'watheq:vision2030Analyzing', 'watheq:vision2030_state',
  'watheq:coverLetter', 'airo:coverLetter', 'watheq:interviewQuestions', 'airo:interviewQuestions',
  'watheq:bulkAnalysis', 'airo:bulkAnalysis',
];
const isPrivateKey = (key: string) => PRIVATE_KEYS.includes(key) || key.startsWith('watheq:freeVerifyUsed:');
const VALUE_PREFIX = 'watheq:privateValue:';
let activeOwner: string | undefined;
let revision = 0;
let switching = false;

// The browser-wide marker invalidates pending work; it never owns this tab's values.
export const getPrivateSessionRevision = () => `${revision}:${activeOwner}:${localStorage.getItem(OWNER_KEY)}:${localStorage.getItem(PRIVATE_EPOCH_STORAGE_KEY)}`;
export function assertPrivateSession(expectedRevision: string, userId?: string | null): void {
  const owner = userId ? `user:${userId}` : 'guest';
  if (expectedRevision !== getPrivateSessionRevision() || (userId !== undefined && activeOwner && owner !== activeOwner)) {
    throw Object.assign(new Error('Your account changed. Retry from the current workspace.'), {
      name: 'AbortError', status: 409, code: 'auth/session-changed', cancelled: true,
    });
  }
}
const valueKey = (owner: string, key: string) => `${VALUE_PREFIX}${encodeURIComponent(owner)}:${key}`;
const scopedKey = (key: string) => activeOwner && isPrivateKey(key) ? valueKey(activeOwner, key) : key;

export const privateStorage = {
  getItem: (key: string) => localStorage.getItem(scopedKey(key)),
  setItem: (key: string, value: string) => {
    if (!switching || !isPrivateKey(key)) localStorage.setItem(scopedKey(key), value);
  },
  removeItem: (key: string) => {
    if (!switching || !isPrivateKey(key)) localStorage.removeItem(scopedKey(key));
  },
};

/** Preserve old bytes without guessing ownership, then select this tab's namespace. */
export function activatePrivateSession(userId: string | null, reset: () => void): void {
  const next = userId ? `user:${userId}` : 'guest';
  if (activeOwner === next && localStorage.getItem(OWNER_KEY) === next) return;
  const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .filter((key): key is string => !!key && isPrivateKey(key));
  if (keys.length) {
    const previous = localStorage.getItem(OWNER_KEY)
      ?? (localStorage.getItem('watheq:lastAuthUserId') ? `user:${localStorage.getItem('watheq:lastAuthUserId')}` : 'legacy');
    const snapshot = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
    localStorage.setItem(`${SNAPSHOT_PREFIX}${previous}`, JSON.stringify(snapshot));
    if (previous !== 'legacy') for (const [key, value] of Object.entries(snapshot)) {
      if (typeof value === 'string' && localStorage.getItem(valueKey(previous, key)) === null) localStorage.setItem(valueKey(previous, key), value);
    }
    keys.forEach(key => localStorage.removeItem(key));
  }
  // Older owner snapshots remain recoverable and only hydrate their named owner.
  const stored = localStorage.getItem(`${SNAPSHOT_PREFIX}${next}`);
  if (stored) {
    const values: unknown = JSON.parse(stored);
    if (values && typeof values === 'object') for (const [key, value] of Object.entries(values)) {
      if (isPrivateKey(key) && typeof value === 'string' && localStorage.getItem(valueKey(next, key)) === null) localStorage.setItem(valueKey(next, key), value);
    }
    localStorage.setItem(`${SNAPSHOT_PREFIX}imported:${next}`, stored);
    localStorage.removeItem(`${SNAPSHOT_PREFIX}${next}`);
  }
  revision += 1;
  switching = true;
  try { reset(); } finally { switching = false; }
  activeOwner = next;
  if (localStorage.getItem(OWNER_KEY) !== next) localStorage.setItem(PRIVATE_EPOCH_STORAGE_KEY, crypto.randomUUID());
  localStorage.setItem(OWNER_KEY, next);
}

export const PRIVATE_OWNER_STORAGE_KEY = OWNER_KEY;
