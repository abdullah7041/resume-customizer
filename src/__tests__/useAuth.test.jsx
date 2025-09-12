import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';

describe('useAuth', () => {
  it('redirects to /resume on Google sign in', async () => {
    supabase.auth.signInWithOAuth = vi.fn().mockResolvedValue({});
    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.signInWithGoogle();
    });
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/resume` },
    });
  });
});
