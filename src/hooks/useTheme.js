import { useEffect, useRef, useState } from "react";

const THEME_STORAGE_KEY = "theme";
const LEGACY_THEME_KEY = "airo:theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

// Check feature flag - if dark mode is disabled, always return light
const isDarkModeEnabled = () => {
  if (typeof import.meta === "undefined" || typeof import.meta.env === "undefined") {
    return true;
  }
  return (import.meta.env.VITE_FEATURE_DARK_MODE ?? "true") !== "false";
};

const readStoredTheme = () => {
  if (typeof window === "undefined") return null;
  
  // If dark mode is disabled, always return light
  if (!isDarkModeEnabled()) {
    return "light";
  }
  
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") {
      return stored;
    }
    const legacy = window.localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy === "dark" || legacy === "light") {
      window.localStorage.setItem(THEME_STORAGE_KEY, legacy);
      return legacy;
    }
  } catch {
    // ignore read failures (e.g., storage disabled)
  }
  return null;
};

const resolvePreferredTheme = () => {
  // If dark mode is disabled, always return light
  if (!isDarkModeEnabled()) {
    return "light";
  }
  
  const stored = readStoredTheme();
  if (stored) {
    return stored;
  }
  if (typeof window !== "undefined") {
    try {
      return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
    } catch {
      // ignore matchMedia failures
    }
  }
  return "light";
};

const applyThemeToDocument = (theme, useTransition = true) => {
  if (typeof document === "undefined") return;
  const isDark = theme === "dark";
  
  // Use View Transitions API if available for smoother color transitions
  const updateTheme = () => {
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.classList.toggle("light", !isDark);
    const value = isDark ? "dark" : "light";
    document.documentElement.dataset.theme = value;
    document.documentElement.setAttribute("data-theme", value);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  };
  
  // Only use View Transitions after initial mount to avoid flash
  if (
    useTransition &&
    typeof document.startViewTransition === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    document.startViewTransition(() => updateTheme());
  } else {
    updateTheme();
  }
};

const persistTheme = (theme) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore persistence failures
  }
};

const readDocumentTheme = () => {
  if (typeof document === "undefined") return null;
  const current = document.documentElement.dataset.theme;
  if (current === "dark" || current === "light") {
    return current;
  }
  if (document.documentElement.classList.contains("dark")) {
    return "dark";
  }
  if (document.documentElement.classList.contains("light")) {
    return "light";
  }
  return null;
};

const ensureDocumentTheme = () => {
  const existing = readDocumentTheme();
  if (existing) {
    // No transition on initial mount - theme already set by bootstrap script
    applyThemeToDocument(existing, false);
    return existing;
  }
  const resolved = resolvePreferredTheme();
  // No transition on initial mount
  applyThemeToDocument(resolved, false);
  return resolved;
};

export const initializeTheme = () => ensureDocumentTheme();

export function useTheme() {
  const [theme, setTheme] = useState(() => ensureDocumentTheme());
  const hasExplicitPreference = useRef(readStoredTheme() !== null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Only apply if this is not the initial mount or if theme changed
    // Use transition for user-initiated changes after mount
    if (!isInitialMount.current) {
      applyThemeToDocument(theme, true);
    }
    isInitialMount.current = false;
  }, [theme]);

  useEffect(() => {
    // If dark mode is disabled, don't listen to system preference changes
    if (typeof window === "undefined" || hasExplicitPreference.current || !isDarkModeEnabled()) {
      return undefined;
    }
    const mediaQuery = window.matchMedia(DARK_QUERY);
    const handleChange = (event) => {
      setTheme(event.matches ? "dark" : "light");
    };
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
    return undefined;
  }, []);

  const toggleTheme = () => {
    // If dark mode is disabled, don't allow toggling
    if (!isDarkModeEnabled()) {
      return;
    }
    
    setTheme((previous) => {
      const next = previous === "dark" ? "light" : "dark";
      hasExplicitPreference.current = true;
      persistTheme(next);
      return next;
    });
  };

  return [theme, toggleTheme];
}

export { THEME_STORAGE_KEY };
