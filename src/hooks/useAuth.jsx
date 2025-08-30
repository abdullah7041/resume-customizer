// src/hooks/useAuth.js
import { useState, useEffect, createContext, useContext } from 'react';
// FIXED: Updated import to use the '@' alias.
import { supabase } from '@/services/supabase.js';

// Create a context to hold the authentication data.
const AuthContext = createContext();

// The AuthProvider component wraps your application and provides the auth context.
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for an active session when the component mounts.
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    };
    
    getSession();

    // Set up a listener for authentication state changes (login, logout).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    // Clean up the listener when the component unmounts.
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const value = {
    user,
    session,
    isPremium,
    loading,
    signInWithGoogle: () => supabase.auth.signInWithOAuth({ provider: 'google' }),
    signOut: () => supabase.auth.signOut(),
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// The useAuth hook is a simple wrapper to consume the AuthContext.
export const useAuth = () => {
  return useContext(AuthContext);
};

