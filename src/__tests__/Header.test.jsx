import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import Header from "../components/Layout/Header.jsx";

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("../hooks/useTheme", () => ({
  useTheme: () => ["light", vi.fn()],
}));

vi.mock("../lib/assets", () => ({
  getSkylineUrl: vi.fn(() => ""),
}));

const createMatchMedia = () => {
  const listeners = new Set();
  return (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: (_event, listener) => {
      if (typeof listener === "function") {
        listeners.add(listener);
      }
    },
    removeEventListener: (_event, listener) => {
      if (typeof listener === "function") {
        listeners.delete(listener);
      }
    },
    addListener: (listener) => {
      if (typeof listener === "function") {
        listeners.add(listener);
      }
    },
    removeListener: (listener) => {
      if (typeof listener === "function") {
        listeners.delete(listener);
      }
    },
    dispatchEvent: (event) => {
      listeners.forEach((listener) => listener(event));
      return true;
    },
  });
};

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: createMatchMedia(),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Header", () => {
  it("keeps the gradient fallback when the skyline URL is empty", () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { container } = render(<Header />);

    expect(container.querySelector(".bg-hero")).toBeNull();

    const fallback = Array.from(container.querySelectorAll('[aria-hidden="true"]')).find((element) =>
      element.className.includes("bg-[radial-gradient"),
    );

    expect(fallback).toBeDefined();

    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("provides accessible labelling for interactive controls and hides decorative icons", () => {
    const { container } = render(<Header />);

    const themeToggle = screen.getByRole("button", { name: /switch to dark theme/i });
    expect(themeToggle).toHaveAttribute("title", "Switch to dark theme");
    expect(themeToggle).toHaveAttribute("aria-pressed");

    container.querySelectorAll("svg").forEach((icon) => {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });
  });
});

