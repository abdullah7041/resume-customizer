import { useEffect, useState, useRef, createContext, useContext } from "react";
import { resolveAuthRedirectUrl } from "../lib/auth/authRedirect";
import { useResumeStore } from "@/lib/stores/resumeStore";
import { analytics } from "../services/analytics";
import { supabase } from "../services/supabase";
import type { User } from "@supabase/supabase-js";

type AuthIntent = "signin" | "signup";
type AuthEntrySource = "header_desktop" | "header_mobile" | "landing_get_started" | "upload_auth_required";

interface SignInWithGoogleOptions {
  intent?: AuthIntent;
  source?: AuthEntrySource;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: (options?: SignInWithGoogleOptions) => Promise<string | undefined>;
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

const SENSITIVE_SESSION_STORAGE_KEYS = [
  "resume-storage",
  "watheq:resumeData",
  "airo:resumeData",
  "watheq:lastJobDescription",
  "airo:lastJobDescription",
  "watheq:vision2030Analysis",
  "watheq:vision2030Analyzing",
  "watheq:vision2030_state",
  "watheq:coverLetter",
  "airo:coverLetter",
  "watheq:interviewQuestions",
  "airo:interviewQuestions",
  "watheq:bulkAnalysis",
  "airo:bulkAnalysis",
];

const setStoredAuthUserId = (userId: string | null) => {
  if (typeof window === "undefined") return;

  if (userId) {
    window.localStorage.setItem(AUTH_SESSION_USER_STORAGE_KEY, userId);
    return;
  }

  window.localStorage.removeItem(AUTH_SESSION_USER_STORAGE_KEY);
};

const clearSensitiveSessionData = () => {
  useResumeStore.getState().clearAll();

  if (typeof window !== "undefined") {
    for (const key of SENSITIVE_SESSION_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
    }
  }
};

const reconcileSensitiveSessionDataForUser = (currentUserId: string | null) => {
  if (typeof window === "undefined") return;

  const storedUserId = window.localStorage.getItem(AUTH_SESSION_USER_STORAGE_KEY);
  if (storedUserId && storedUserId !== currentUserId) {
    clearSensitiveSessionData();
  }

  setStoredAuthUserId(currentUserId);
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

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isActive = true;
    // Capture referral parameter on mount
    captureReferralParam();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isActive) return;
      const currentUser = session?.user || null;
      const currentUserId = currentUser?.id || null;
      const previousUserId = lastUserIdRef.current;
      if (previousUserId && previousUserId !== currentUserId) {
        clearSensitiveSessionData();
      }
      reconcileSensitiveSessionDataForUser(currentUserId);

      setUser(currentUser);
      setLoading(false);

      // Track referral for new signups
      if (currentUser && !previousUserId && _event === "SIGNED_IN") {
        trackReferralAfterSignup(currentUser.id, session?.access_token);
      }

      lastUserIdRef.current = currentUserId;
    });

    getInitialAuthSession().then(({ data: { session } }) => {
      if (!isActive) return;
      const currentUser = session?.user || null;
      const currentUserId = currentUser?.id || null;
      reconcileSensitiveSessionDataForUser(currentUserId);
      setUser(currentUser);
      lastUserIdRef.current = currentUserId;
      setLoading(false);
    });

    return () => {
      isActive = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async (options: SignInWithGoogleOptions = {}) => {
    if (options.intent === "signup") {
      analytics.trackSignupStarted(options.source);
    } else {
      analytics.trackSigninStarted(options.source);
    }

    const redirectUrl = resolveRedirectUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
    });
    if (error) {
      console.error("Google login error:", error.message);
      return;
    }

    if (data?.url) {
      let targetUrl;
      try {
        const authUrl = new URL(data.url);
        if (redirectUrl) {
          authUrl.searchParams.set("redirect_to", redirectUrl);
        }
        targetUrl = authUrl.toString();
        // Enforce the computed redirect target across Supabase environments.
        window.location.assign(targetUrl);
      } catch (navigationError) {
        console.error("Google redirect resolution failed:", navigationError);
      }
      return targetUrl ?? redirectUrl;
    }

    return redirectUrl;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearSensitiveSessionData();
    setStoredAuthUserId(null);
    lastUserIdRef.current = null;
    setUser(null);
  };

  return (
    <AuthContext.Provider key={user?.id || "anonymous"} value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
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




