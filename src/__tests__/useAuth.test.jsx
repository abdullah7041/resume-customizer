/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from '@testing-library/react';

const { mockSignIn, mockOnAuth, mockGetSession } = vi.hoisted(() => ({
  mockSignIn: vi.fn().mockResolvedValue({}),
  mockOnAuth: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  mockGetSession: vi.fn().mockResolvedValue({ data: { session: null } }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: mockSignIn,
      onAuthStateChange: mockOnAuth,
      getSession: mockGetSession,
      signOut: vi.fn(),
    },
  }),
}));

import { AuthProvider, useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';

describe('useAuth', () => {
  it('redirects to /resume on Google sign in', async () => {
    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.signInWithGoogle();
    });
    expect(mockSignIn).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/resume` },
    });
  });
});
