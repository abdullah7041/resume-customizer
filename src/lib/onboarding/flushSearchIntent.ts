// src/lib/onboarding/flushSearchIntent.ts
// Guest -> sign-in flush. A guest can complete onboarding before signing in, so the
// searchIntent lives only in the local store (persisted under `resume-storage`). On
// the first sign-in, push it to the server — idempotently: if the server row already
// has an intent, leave it (server wins). Called from useAuth on SIGNED_IN.
import { useResumeStore } from '@/lib/stores/resumeStore';

const USER_DATA_API = '/.netlify/functions/user-data-api';

export async function flushSearchIntentOnSignIn(accessToken?: string): Promise<void> {
  const localIntent = useResumeStore.getState().searchIntent;
  if (!localIntent) return; // nothing collected as a guest

  if (!accessToken) {
    console.warn('[useAuth] Cannot flush searchIntent without an auth token');
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  try {
    // Idempotent: if the server already has an intent, do not overwrite it.
    const existing = await fetch(USER_DATA_API, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'get_search_intent' }),
    });
    if (existing.ok) {
      const data = await existing.json().catch(() => ({}));
      if (data?.searchIntent) return; // server already has intent — skip
    }

    const saved = await fetch(USER_DATA_API, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'save_search_intent', searchIntent: localIntent }),
    });
    if (!saved.ok) {
      const err = await saved.json().catch(() => ({}));
      console.error('[useAuth] Failed to flush searchIntent:', err);
    }
  } catch (error) {
    console.error('[useAuth] Error flushing searchIntent:', error);
  }
}
