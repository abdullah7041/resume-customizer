import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, renderHook, act, waitFor } from "@testing-library/react";
import { StrictMode, useEffect } from "react";

const { authState, mockSignIn, mockSignOut, mockOnAuth, mockGetSession } = vi.hoisted(() => {
  const authState = { callback: undefined };

  return {
    authState,
    mockSignIn: vi
      .fn()
      .mockResolvedValue({
        data: {
          url: "https://example.supabase.co/oauth?redirect_to=http://localhost:3000",
        },
      }),
    mockSignOut: vi.fn().mockResolvedValue({ error: null }),
    mockOnAuth: vi.fn((callback) => {
      authState.callback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    mockGetSession: vi.fn().mockResolvedValue({ data: { session: null } }),
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: mockSignIn,
      onAuthStateChange: mockOnAuth,
      getSession: mockGetSession,
      signOut: mockSignOut,
    },
  }),
}));

import { AuthProvider, useAuth } from '../hooks/useAuth';
import { useResumeStore } from '../lib/stores/resumeStore';

describe('useAuth', () => {
  beforeEach(() => {
    mockSignIn.mockClear();
    mockSignOut.mockClear();
    mockOnAuth.mockClear();
    mockGetSession.mockReset();
    mockGetSession.mockResolvedValue({ data: { session: null } });
    authState.callback = undefined;
    localStorage.clear();
    useResumeStore.getState().clearAll();
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

  it('clears sensitive local session data on sign out', async () => {
    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });

    localStorage.setItem("resume-storage", JSON.stringify({ state: { parsedResumeText: "private" } }));
    localStorage.setItem("watheq:resumeData", JSON.stringify({ basics: { name: "Private" } }));
    localStorage.setItem("watheq:lastJobDescription", "private job description");
    localStorage.setItem("watheq:coverLetter", JSON.stringify({ coverLetter: "private" }));
    localStorage.setItem("watheq:onboardingTourCompleted", "true");

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalled();
    expect(localStorage.getItem("resume-storage")).toBeNull();
    expect(localStorage.getItem("watheq:resumeData")).toBeNull();
    expect(localStorage.getItem("watheq:lastJobDescription")).toBeNull();
    expect(localStorage.getItem("watheq:coverLetter")).toBeNull();
    expect(localStorage.getItem("watheq:onboardingTourCompleted")).toBe("true");
  });

  it('clears sensitive cached data when the initial signed-in user differs from the cached auth user', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: "user-b" },
          access_token: "token-b",
        },
      },
    });

    localStorage.setItem("watheq:lastAuthUserId", "user-a");
    localStorage.setItem("resume-storage", JSON.stringify({ state: { parsedResumeText: "private" } }));
    localStorage.setItem("watheq:resumeData", JSON.stringify({ basics: { name: "Private" } }));
    localStorage.setItem("airo:resumeData", JSON.stringify({ basics: { name: "Legacy Private" } }));
    localStorage.setItem("watheq:lastJobDescription", "private job description");
    localStorage.setItem("airo:lastJobDescription", "legacy private job description");
    localStorage.setItem("watheq:coverLetter", JSON.stringify({ coverLetter: "private" }));
    localStorage.setItem("airo:coverLetter", JSON.stringify({ coverLetter: "legacy private" }));
    localStorage.setItem("watheq:onboardingTourCompleted", "true");
    localStorage.setItem("watheq:lastActiveTab", "templates");
    useResumeStore.getState().setParsedResumeText("private resume text ".repeat(8));

    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user?.id).toBe("user-b");
    expect(localStorage.getItem("resume-storage")).toBeNull();
    expect(localStorage.getItem("watheq:resumeData")).toBeNull();
    expect(localStorage.getItem("airo:resumeData")).toBeNull();
    expect(localStorage.getItem("watheq:lastJobDescription")).toBeNull();
    expect(localStorage.getItem("airo:lastJobDescription")).toBeNull();
    expect(localStorage.getItem("watheq:coverLetter")).toBeNull();
    expect(localStorage.getItem("airo:coverLetter")).toBeNull();
    expect(localStorage.getItem("watheq:lastAuthUserId")).toBe("user-b");
    expect(localStorage.getItem("watheq:onboardingTourCompleted")).toBe("true");
    expect(localStorage.getItem("watheq:lastActiveTab")).toBe("templates");
    expect(useResumeStore.getState().parsedResumeText).toBeNull();
  });

  it('clears sensitive cached data when auth changes directly between signed-in users', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: "user-a" },
          access_token: "token-a",
        },
      },
    });

    localStorage.setItem("watheq:lastAuthUserId", "user-a");
    localStorage.setItem("resume-storage", JSON.stringify({ state: { parsedResumeText: "private" } }));
    localStorage.setItem("watheq:resumeData", JSON.stringify({ basics: { name: "Private" } }));
    localStorage.setItem("watheq:lastJobDescription", "private job description");
    localStorage.setItem("watheq:onboardingTourCompleted", "true");
    useResumeStore.getState().setParsedResumeText("private resume text ".repeat(8));

    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.user?.id).toBe("user-a"));

    await act(async () => {
      authState.callback("SIGNED_IN", {
        user: { id: "user-b" },
        access_token: "token-b",
      });
    });

    expect(result.current.user?.id).toBe("user-b");
    expect(localStorage.getItem("resume-storage")).toBeNull();
    expect(localStorage.getItem("watheq:resumeData")).toBeNull();
    expect(localStorage.getItem("watheq:lastJobDescription")).toBeNull();
    expect(localStorage.getItem("watheq:lastAuthUserId")).toBe("user-b");
    expect(localStorage.getItem("watheq:onboardingTourCompleted")).toBe("true");
    expect(useResumeStore.getState().parsedResumeText).toBeNull();
  });

  it('shares the pending initial session lookup across StrictMode remounts', async () => {
    let resolveSession;
    mockGetSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        })
    );

    const wrapper = ({ children }) => (
      <StrictMode>
        <AuthProvider>{children}</AuthProvider>
      </StrictMode>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(mockGetSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSession({
        data: {
          session: {
            user: { id: "user-strict" },
            access_token: "token-strict",
          },
        },
      });
    });

    await waitFor(() => expect(result.current.user?.id).toBe("user-strict"));
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  it('does not remount the authenticated subtree when auth state changes from anonymous to signed in', async () => {
    const mountProbe = vi.fn();

    function Probe() {
      useAuth();
      useEffect(() => {
        mountProbe();
      }, []);
      return <div>probe</div>;
    }

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    expect(mountProbe).toHaveBeenCalledTimes(1);

    await act(async () => {
      authState.callback("SIGNED_IN", {
        user: { id: "user-a", email: "user@example.com" },
        access_token: "token-a",
      });
    });

    expect(mountProbe).toHaveBeenCalledTimes(1);
  });
});




