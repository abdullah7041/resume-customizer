// src/lib/onboarding/intentPromptFlag.ts
// "User has resolved the post-upload intent prompt" flag (completed OR dismissed).
// Stops the inline Path-A panel from re-appearing on every render when the user
// skipped every slot and searchIntent is still empty. Storage key uses watheq: prefix.
const INTENT_PROMPTED_KEY = 'watheq:intentPrompted';

export function isIntentPrompted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(INTENT_PROMPTED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markIntentPrompted(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(INTENT_PROMPTED_KEY, 'true');
  } catch {
    // Private mode / storage disabled — panel falls back to searchIntent presence.
  }
}
