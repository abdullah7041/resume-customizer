import { createClient, SupabaseClient } from '@supabase/supabase-js';

let instance: SupabaseClient | null = null;

/**
 * Get or create a Supabase client instance for privileged server operations.
 *
 * This ensures consistent initialization across all Netlify functions by:
 * 1. Using singleton pattern to avoid multiple client instances
 * 2. Requiring server-only Supabase credentials
 *
 * @returns SupabaseClient instance or null if server credentials are missing
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (instance) return instance;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('[Supabase] Missing server credentials. SUPABASE_URL:', !!url, 'SUPABASE_SERVICE_ROLE_KEY:', !!key);
    return null;
  }

  // createClient can throw at construction (e.g. supabase-js realtime requiring a
  // WebSocket the runtime does not provide). Never let that escape as a raw
  // function crash / 502 — return null so callers surface a clean JSON 500/503.
  try {
    instance = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } catch (error) {
    console.error('[Supabase] Failed to construct client:', error instanceof Error ? error.message : error);
    return null;
  }

  console.log('[Supabase] Client initialized successfully');
  return instance;
}
