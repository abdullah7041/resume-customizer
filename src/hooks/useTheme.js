import { useCallback, useEffect, useRef, useState } from "react";

const THEME_STORAGE_KEY = "theme";
const LEGACY_THEME_KEY = "airo:theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

const readStoredTheme = () => {
  if (typeof window === "undefined") return null;
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

const applyThemeToDocument = (theme) => {
  if (typeof document === "undefined") return;
  const isDark = theme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
};

const persistTheme = (theme) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore persistence failures
  }
};

export function useTheme() {
  const [theme, setTheme] = useState(() => resolvePreferredTheme());
  const hasExplicitPreference = useRef(readStoredTheme() !== null);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined" || hasExplicitPreference.current) {
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

  const setExplicitTheme = useCallback((nextTheme) => {
    const normalized = nextTheme === "dark" ? "dark" : "light";
    hasExplicitPreference.current = true;
    setTheme((prev) => {
      if (prev === normalized) {
        persistTheme(normalized);
        return prev;
      }
      persistTheme(normalized);
      return normalized;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setExplicitTheme((theme === "dark" ? "light" : "dark"));
  }, [setExplicitTheme, theme]);

  return {
    theme,
    isDark: theme === "dark",
    setTheme: setExplicitTheme,
    toggleTheme,
  };
}

export { THEME_STORAGE_KEY };
