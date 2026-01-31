import { supabase } from '../../services/supabase';

/**
 * Get authenticated headers for API requests.
 *
 * Includes:
 * - Content-Type: application/json
 * - Authorization: Bearer <token> (if user is signed in)
 *
 * @returns Headers object with authentication token if available
 * @throws Error if user is not authenticated
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Authentication required. Please sign in to continue.');
  }

  headers.Authorization = `Bearer ${session.access_token}`;

  return headers;
}
