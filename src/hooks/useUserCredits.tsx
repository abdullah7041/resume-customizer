/**
 * useUserCredits Hook
 *
 * Re-exports the shared credits context for backward compatibility.
 * All credit state is now centralized in CreditsContext for sync across components.
 */

import { useCredits } from '../contexts/CreditsContext';

interface UseUserCreditsReturn {
  credits: import('../types/credits').UserCredits | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  showUpgrade: boolean;
  setShowUpgrade: (show: boolean) => void;
  upgradeDismissedKey: string | null;
}

/**
 * Hook to access user credits - now uses shared CreditsContext
 */
export function useUserCredits(): UseUserCreditsReturn {
  return useCredits();
}

