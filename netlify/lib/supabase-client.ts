import { createClient, SupabaseClient } from '@supabase/supabase-js';

let instance: SupabaseClient | null = null;

/**
 * Get or create a Supabase client instance with fallback environment variables.
 *
 * This ensures consistent initialization across all Netlify functions by:
 * 1. Using singleton pattern to avoid multiple client instances
 * 2. Falling back from SUPABASE_URL to VITE_SUPABASE_URL (build-time vars)
 * 3. Falling back from SUPABASE_SERVICE_ROLE_KEY to VITE_SUPABASE_ANON_KEY
 *
 * @returns SupabaseClient instance or null if credentials are missing
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (instance) return instance;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('[Supabase] Missing credentials. URL:', !!url, 'Key:', !!key);
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
