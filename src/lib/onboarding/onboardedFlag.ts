// src/lib/onboarding/onboardedFlag.ts
// One-time "user has seen onboarding" flag. Breaks the first-run gate loop for the
// lazy user who skips every slot (no resume + no intent would otherwise keep
// needsOnboarding true forever). Storage key uses the watheq: prefix.
const ONBOARDED_KEY = 'watheq:onboarded';

export function isOnboarded(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(ONBOARDED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markOnboarded(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ONBOARDED_KEY, 'true');
  } catch {
    // Private mode / storage disabled — gate falls back to resume/intent presence.
  }
}
