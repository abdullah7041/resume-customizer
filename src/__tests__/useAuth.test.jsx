/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { mockSignIn, mockOnAuth, mockGetSession } = vi.hoisted(() => ({
  mockSignIn: vi
    .fn()
    .mockResolvedValue({
      data: {
        url: "https://example.supabase.co/oauth?redirect_to=http://localhost:3000",
      },
    }),
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

describe('useAuth', () => {
  beforeEach(() => {
    mockSignIn.mockClear();
  });

  it('enforces redirect url on Google sign in', async () => {
    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });
    let attemptedRedirect;
    await act(async () => {
      attemptedRedirect = await result.current.signInWithGoogle();
    });
    expect(mockSignIn).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: expect.stringMatching(/^https?:\/\//), skipBrowserRedirect: true },
    });
    expect(attemptedRedirect).toBeTruthy();
    const redirectUrl = new URL(attemptedRedirect);
    expect(redirectUrl.searchParams.get('redirect_to')).toEqual(expect.stringMatching(/^https?:\/\//));
  });
});




