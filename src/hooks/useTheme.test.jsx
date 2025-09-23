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
    delete document.documentElement.dataset.theme;
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

    expect(result.current.theme).toBe("dark");
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("can toggle themes and persist the choice", () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("light");

    act(() => {
      result.current.setTheme("dark");
    });

    expect(result.current.theme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("responds to system preference changes when unset", () => {
    const controller = setupMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("light");

    act(() => {
      controller.update(true);
    });

    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
