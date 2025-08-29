// src/hooks/useAuth.js
import { useState, useEffect } from 'react';
// Note: We will set up the supabase client in a separate file later.
// For now, this hook prepares the structure for authentication.

/**
 * A custom React hook to manage user authentication state.
 * This will be responsible for tracking the current user, session,
 * and whether they are a premium member.
 *
 * @returns {object} - An object containing user, session, isPremium, and loading status.
 */
export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true); // Start as true to check auth state on load

  useEffect(() => {
    // In a future step, we will add the Supabase listener here
    // to automatically update the auth state when the user logs in or out.
    // For example: const { data: { subscription } } = supabase.auth.onAuthStateChange(...)
    
    // For now, we just simulate the loading process finishing.
    setLoading(false);

    // Mock functions for demonstration until Supabase is fully wired up.
    const mockLogin = () => {
      setUser({ id: 'demo-user-123', name: 'John Doe', email: 'john@example.com' });
      setSession('demo-session-token');
      setIsPremium(false); // Default to non-premium on login
    };

    const upgradeToPremium = () => {
      if (user) {
        setIsPremium(true);
      }
    };

    // We will replace these mocks with real Supabase calls.
    // window.mockLogin = mockLogin;
    // window.upgradeToPremium = upgradeToPremium;

  }, []);

  // The hook returns the current authentication state, which can be used by any component.
  return { user, session, isPremium, loading };
};
