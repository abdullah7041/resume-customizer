import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTheme, THEME_STORAGE_KEY } from "./useTheme";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const originalMatchMedia = typeof window !== "undefined" ? window.matchMedia : undefined;

const setupMatchMedia = (matches = false) => {
  const listeners = new Set();
  const mql = {
    matches,
    media: DARK_QUERY,
    addEventListener: (event, handler) => {
      if (event === "change") {
        listeners.add(handler);
      }
    },
    removeEventListener: (event, handler) => {
      if (event === "change") {
        listeners.delete(handler);
      }
    },
    addListener: (handler) => {
      listeners.add(handler);
    },
    removeListener: (handler) => {
      listeners.delete(handler);
    },
    dispatchEvent: (event) => {
      listeners.forEach((listener) => listener(event));
      return true;
    },
  };

  window.matchMedia = vi.fn().mockImplementation(() => mql);

  return {
    update: (nextMatches) => {
      mql.matches = nextMatches;
      const event = { matches: nextMatches, media: DARK_QUERY };
      listeners.forEach((listener) => listener(event));
    },
  };
};

describe("useTheme", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.remove("light");
    delete document.documentElement.dataset.theme;
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia;
    } else {
      delete window.matchMedia;
    }
  });

  it("uses stored preference and applies document theming", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    setupMatchMedia(false);

    const { result } = renderHook(() => useTheme());

    expect(result.current[0]).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("always uses dark theme (theme is locked)", () => {
    window.localStorage.clear();
    window.localStorage.removeItem(THEME_STORAGE_KEY);
    const controller = setupMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    // Theme is always dark
    expect(result.current[0]).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    // Toggle does nothing - theme remains dark
    act(() => {
      result.current[1]();
    });

    expect(result.current[0]).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("ignores system preference changes (theme is locked to dark)", () => {
    const controller = setupMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    // Theme is always dark regardless of system preference
    expect(result.current[0]).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);

    // System preference change has no effect
    act(() => {
      controller.update(true);
    });

    expect(result.current[0]).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("always applies dark theme to document", () => {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.remove("light");
    delete document.documentElement.dataset.theme;

    const { result } = renderHook(() => useTheme());

    // Theme is always dark
    expect(result.current[0]).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });
});
