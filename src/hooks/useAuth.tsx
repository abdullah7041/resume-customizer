import { useCallback, useEffect, useMemo, useState, useRef, Fragment, createContext, useContext } from "react";
import { resolveAuthRedirectUrl } from "../lib/auth/authRedirect";
import { useResumeStore } from "@/lib/stores/resumeStore";
import { useResumeLibraryStore } from "@/lib/resumeLibrary";
import { activatePrivateSession, getPrivateSessionRevision, PRIVATE_EPOCH_STORAGE_KEY, PRIVATE_OWNER_STORAGE_KEY } from "@/lib/auth/privateSession";
import { flushSearchIntentOnSignIn } from "@/lib/onboarding/flushSearchIntent";
import { analytics } from "../services/analytics";
import { supabase } from "../services/supabase";
import type { User } from "@supabase/supabase-js";
import { useTranslation } from "react-i18next";

type AuthIntent = "signin" | "signup";
export type AuthEntrySource = "header_desktop" | "header_mobile" | "landing_get_started" | "upload_auth_required";

interface SignInOptions {
  intent?: AuthIntent;
  source?: AuthEntrySource;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: (options?: SignInOptions) => Promise<string | undefined>;
  signInWithLinkedIn: (options?: SignInOptions) => Promise<string | undefined>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_SESSION_USER_STORAGE_KEY = "watheq:lastAuthUserId";
type AuthSessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>;
let pendingInitialSessionPromise: Promise<AuthSessionResult> | null = null;

const getInitialAuthSession = () => {
  if (!pendingInitialSessionPromise) {
    pendingInitialSessionPromise = supabase.auth
      .getSession()
      .finally(() => {
        pendingInitialSessionPromise = null;
      });
  }

  return pendingInitialSessionPromise;
};

const reconcileSensitiveSessionDataForUser = (userId: string | null) => {
  activatePrivateSession(userId, () => {
    useResumeLibraryStore.getState().setScope(null);
    useResumeStore.setState(useResumeStore.getInitialState(), true);
  });
  useResumeLibraryStore.getState().setScope(userId ? `user:${userId}` : 'guest');
  void useResumeStore.persist.rehydrate();
  if (userId) localStorage.setItem(AUTH_SESSION_USER_STORAGE_KEY, userId);
  else localStorage.removeItem(AUTH_SESSION_USER_STORAGE_KEY);
  return getPrivateSessionRevision();
};

const resolveRedirectUrl = () => {
  return resolveAuthRedirectUrl({
    envRedirectUrl: import.meta.env?.VITE_SUPABASE_REDIRECT_URL,
    location: typeof window === "undefined" ? undefined : window.location,
    logger: console,
  });
};

/**
 * Capture and store referral parameter from URL
 */
const captureReferralParam = () => {
  if (typeof window === "undefined") return;

  const searchParams = new URLSearchParams(window.location.search);
  const refParam = searchParams.get("ref");

  if (refParam) {
    localStorage.setItem("watheq:pending_referrer_id", refParam);

    // Clean up URL without reloading
    const cleanUrl = window.location.href.split("?")[0];
    window.history.replaceState({}, document.title, cleanUrl);
  }
};

/**
 * Track referral after user signup
 */
const trackReferralAfterSignup = async (userId: string, accessToken?: string) => {
  const referrerId = localStorage.getItem("watheq:pending_referrer_id");

  if (!referrerId || referrerId === userId) {
    return; // No referral to track
  }

  if (!accessToken) {
    console.warn("[useAuth] Cannot track referral without an auth token");
    return;
  }

  try {
    const response = await fetch("/.netlify/functions/referral-api", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: "track",
        referral_code: referrerId,
      }),
    });

    if (response.ok) {
      localStorage.removeItem("watheq:pending_referrer_id");
      // Dispatch event to notify credits were earned
      window.dispatchEvent(new CustomEvent('referralCreditsEarned', {
        detail: { creditsAdded: 5 }
      }));

      // Trigger immediate credits refresh
      window.dispatchEvent(new Event('refreshCredits'));
    } else {
      const errorData = await response.json();
      console.error("[useAuth] Failed to track referral:", errorData);
    }
  } catch (error) {
    console.error("[useAuth] Error tracking referral:", error);
  }
};

const signInWithProvider = async (provider: "google" | "linkedin_oidc", options: SignInOptions = {}) => {
  if (options.intent === "signup") {
    analytics.trackSignupStarted(options.source);
  } else {
    analytics.trackSigninStarted(options.source);
  }

  const redirectUrl = resolveRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
  });
  if (error) {
    console.error("[useAuth] OAuth sign-in failed:", provider, error.message);
    return;
  }

  if (data?.url) {
    try {
      const authUrl = new URL(data.url);
      if (redirectUrl) {
        authUrl.searchParams.set("redirect_to", redirectUrl);
      }
      const targetUrl = authUrl.toString();
      // Enforce the computed redirect target across Supabase environments.
      window.location.assign(targetUrl);
      return targetUrl;
    } catch (navigationError) {
      console.error("[useAuth] OAuth redirect failed:", provider, navigationError);
    }
  }
};

const signInWithGoogle = (options?: SignInOptions) => signInWithProvider("google", options);
const signInWithLinkedIn = (options?: SignInOptions) => signInWithProvider("linkedin_oidc", options);

export const AuthProvider = ({ children }) => {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionFailed, setSessionFailed] = useState(false);
  const [privateScopeRevision, setPrivateScopeRevision] = useState('unresolved');
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isActive = true;
    let authRevision = 0;
    const failSession = (error: unknown) => {
      if (!isActive) return;
      console.error('[useAuth] Could not open the private session:', error);
      useResumeLibraryStore.getState().setScope(null);
      setLoading(true);
      setSessionFailed(true);
    };
    // Capture referral parameter on mount
    captureReferralParam();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isActive) return;
      authRevision += 1;
      const currentUser = session?.user || null;
      const currentUserId = currentUser?.id || null;
      const previousUserId = lastUserIdRef.current;
      try { setPrivateScopeRevision(reconcileSensitiveSessionDataForUser(currentUserId)); }
      catch (error) { failSession(error); return; }

      setUser(currentUser);
      setSessionFailed(false);
      setLoading(false);

      // Track referral for new signups
      if (currentUser && !previousUserId && _event === "SIGNED_IN") {
        trackReferralAfterSignup(currentUser.id, session?.access_token);
        // Flush any guest-collected searchIntent to the server (idempotent).
        flushSearchIntentOnSignIn(session?.access_token);
      }

      lastUserIdRef.current = currentUserId;
    });

    getInitialAuthSession().then(({ data: { session }, error }) => {
      if (!isActive || authRevision !== 0) return;
      if (error) throw error;
      const currentUser = session?.user || null;
      const currentUserId = currentUser?.id || null;
      setPrivateScopeRevision(reconcileSensitiveSessionDataForUser(currentUserId));
      setUser(currentUser);
      lastUserIdRef.current = currentUserId;
      setSessionFailed(false);
      setLoading(false);
    }).catch(error => { if (authRevision === 0) failSession(error); });

    const handleOwnerChange = (event: StorageEvent) => {
      if (event.key !== PRIVATE_OWNER_STORAGE_KEY && event.key !== PRIVATE_EPOCH_STORAGE_KEY) return;
      // Unmount private consumers immediately; Supabase will resolve the new identity.
      setLoading(true);
      useResumeLibraryStore.getState().setScope(null);
      const requestedRevision = ++authRevision;
      void supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (!isActive || requestedRevision !== authRevision) return;
        if (error) throw error;
        const next = session?.user ?? null;
        setPrivateScopeRevision(reconcileSensitiveSessionDataForUser(next?.id ?? null));
        lastUserIdRef.current = next?.id ?? null;
        setUser(next);
        setSessionFailed(false);
        setLoading(false);
      }).catch(error => { if (requestedRevision === authRevision) failSession(error); });
    };
    window.addEventListener('storage', handleOwnerChange);
    return () => {
      window.removeEventListener('storage', handleOwnerChange);
      isActive = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) { setLoading(false); throw error; }
    try { setPrivateScopeRevision(reconcileSensitiveSessionDataForUser(null)); }
    catch (error) { setSessionFailed(true); throw error; }
    setSessionFailed(false);
    setLoading(false);
    lastUserIdRef.current = null;
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signInWithGoogle, signInWithLinkedIn, signOut }),
    [user, loading, signOut],
  );

  return (
    <AuthContext.Provider value={value}>
      {sessionFailed && <div role="alert">
        <p>{t('common.sessionUnavailable', 'Your saved workspace could not be opened. Reload to try again.')}</p>
        <button type="button" onClick={() => window.location.reload()}>{t('common.retry', 'Try Again')}</button>
      </div>}
      {!loading && <Fragment key={privateScopeRevision}>{children}</Fragment>}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};




