import { useEffect, useState, useRef, createContext, useContext } from "react";
import { supabase } from "../services/supabase";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<string | undefined>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const isLocalhostLike = (hostname = "") => {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized.endsWith(".local")
  );
};

const resolveRedirectUrl = () => {
  const envOverride = import.meta.env?.VITE_SUPABASE_REDIRECT_URL;

  if (typeof window === "undefined") {
    return typeof envOverride === "string" && envOverride.trim()
      ? envOverride.trim()
      : undefined;
  }

  if (typeof envOverride === "string" && envOverride.trim()) {
    const trimmed = envOverride.trim();
    try {
      const overrideUrl = new URL(trimmed, window.location.origin);
      const overrideHost = overrideUrl.hostname;
      const currentHost = window.location.hostname;

      if (isLocalhostLike(overrideHost) && !isLocalhostLike(currentHost)) {
        // Ignore localhost overrides when running on a remote tunnel / codespace.
      } else {
        return overrideUrl.toString();
      }
    } catch (error) {
      console.warn("Invalid VITE_SUPABASE_REDIRECT_URL, falling back to window origin", error);
    }
  }

  const { origin, pathname } = window.location;
  if (pathname && pathname !== "/") {
    return `${origin}${pathname}`;
  }
  return origin;
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
const trackReferralAfterSignup = async (userId: string, userEmail?: string) => {
  const referrerId = localStorage.getItem("watheq:pending_referrer_id");

  if (!referrerId || referrerId === userId) {
    return; // No referral to track
  }

  try {
    const response = await fetch("/.netlify/functions/referral-api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "track",
        referral_code: referrerId,
        referee_id: userId,
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
    // Capture referral parameter on mount
    captureReferralParam();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      setLoading(false);

      // Track referral for new signups
      if (currentUser && !lastUserIdRef.current && _event === "SIGNED_IN") {
        trackReferralAfterSignup(currentUser.id, currentUser.email);
      }

      lastUserIdRef.current = currentUser?.id || null;
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      lastUserIdRef.current = currentUser?.id || null;
      setLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
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
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
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




