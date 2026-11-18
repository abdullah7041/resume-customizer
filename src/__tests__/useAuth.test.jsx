import { activatePrivateSession, privateStorage } from '@/lib/auth/privateSession';
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
import { useResumeLibraryStore } from '../lib/resumeLibrary';

describe('useAuth', () => {
  it('keeps private content hidden and offers recovery when session lookup fails', async () => {
    mockGetSession.mockRejectedValueOnce(new Error('offline'));
    const view = render(<AuthProvider><div>private workspace</div></AuthProvider>);
    await waitFor(() => expect(view.getByRole('alert')).toBeTruthy());
    expect(view.queryByText('private workspace')).toBeNull();
    expect(view.getByRole('button')).toBeTruthy();
  });

  it('hides children until authentication is resolved', async () => {
    let finish;
    mockGetSession.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = render(<AuthProvider><div>private workspace</div></AuthProvider>);
    const initialContent = view.queryByText('private workspace');
    await act(async () => { finish({ data: { session: null } }); });
    expect(initialContent).toBeNull();
    expect(view.getByText('private workspace')).toBeTruthy();
  });

  it('locks the library on logout and restores only the returning owner session', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'owner-a' } } } });
    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user?.id).toBe('owner-a'));
    useResumeStore.getState().setParsedResumeText('Owner A private source resume text. '.repeat(5));
    useResumeLibraryStore.setState({ entries: [{ id: 'private-a', name: 'Private A' }], activeResumeId: 'private-a' });
    await act(async () => { await result.current.signOut(); });
    expect(useResumeLibraryStore.getState().entries).toEqual([]);
    expect(useResumeStore.getState().parsedResumeText).toBeNull();
    await act(async () => { authState.callback('SIGNED_IN', { user: { id: 'owner-b' } }); });
    expect(useResumeStore.getState().parsedResumeText).toBeNull();
    await act(async () => { authState.callback('SIGNED_IN', { user: { id: 'owner-a' } }); });
    expect(useResumeStore.getState().parsedResumeText).toContain('Owner A private source');
  });

  it('does not restore a stale cross-tab session lookup after a newer auth event', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'race-a' } } } });
    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current?.user?.id).toBe('race-a'));
    let resolveOld;
    mockGetSession.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    await act(async () => { window.dispatchEvent(new StorageEvent('storage', { key: 'watheq:privateOwner' })); });
    await act(async () => { authState.callback('SIGNED_IN', { user: { id: 'race-b' } }); });
    await act(async () => { resolveOld({ data: { session: { user: { id: 'race-a' } } } }); });
    expect(result.current.user.id).toBe('race-b');
  });
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

  it.each([
    ['Google', 'signInWithGoogle', 'google'],
    ['LinkedIn', 'signInWithLinkedIn', 'linkedin_oidc'],
  ])('enforces the Watheq redirect URL on %s sign in', async (_name, signIn, provider) => {
    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });
    let attemptedRedirect;
    await waitFor(() => expect(result.current?.loading).toBe(false));
    await act(async () => {
      attemptedRedirect = await result.current[signIn]();
    });
    expect(mockSignIn).toHaveBeenCalledWith({
      provider,
      options: { redirectTo: expect.stringMatching(/^https?:\/\//), skipBrowserRedirect: true },
    });
    expect(attemptedRedirect).toBeTruthy();
    const redirectUrl = new URL(attemptedRedirect);
    expect(redirectUrl.searchParams.get('redirect_to')).toEqual(expect.stringMatching(/^https?:\/\//));
  });

  it('clears sensitive local session data on sign out', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'signed-out-test' } } } });
    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current?.loading).toBe(false));

    privateStorage.setItem("resume-storage", JSON.stringify({ state: { parsedResumeText: "private" } }));
    privateStorage.setItem("watheq:resumeData", JSON.stringify({ basics: { name: "Private" } }));
    privateStorage.setItem("watheq:lastJobDescription", "private job description");
    privateStorage.setItem("watheq:coverLetter", JSON.stringify({ coverLetter: "private" }));
    privateStorage.setItem("watheq:onboardingTourCompleted", "true");

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalled();
    expect(JSON.parse(privateStorage.getItem("resume-storage") || '{}').state?.parsedResumeText ?? null).toBeNull();
    expect(privateStorage.getItem("watheq:resumeData")).toBeNull();
    expect(privateStorage.getItem("watheq:lastJobDescription")).toBeNull();
    expect(privateStorage.getItem("watheq:coverLetter")).toBeNull();
    expect(privateStorage.getItem("watheq:onboardingTourCompleted")).toBe("true");
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

    activatePrivateSession("user-a", () => {});
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

  it('remounts private consumers when the authenticated owner changes', async () => {
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

    await waitFor(() => expect(mountProbe).toHaveBeenCalledTimes(1));

    await act(async () => {
      authState.callback("SIGNED_IN", {
        user: { id: "user-a", email: "user@example.com" },
        access_token: "token-a",
      });
    });

    expect(mountProbe).toHaveBeenCalledTimes(2);
  });
});




