import { useEffect, useState, createContext, useContext } from "react";
import { supabase } from "../services/supabase";

const AuthContext = createContext();

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

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
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

export const useAuth = () => useContext(AuthContext);



