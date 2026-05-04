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

  instance = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('[Supabase] Client initialized successfully');
  return instance;
}
