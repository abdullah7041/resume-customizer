import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import Header from "../components/Layout/Header";
import { DirectionProvider } from "../components/providers/DirectionProvider";

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("../lib/assets", () => ({
  getSkylineUrl: vi.fn(() => ""),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        "common.appName": "AI Resume Optimizer",
        "common.signIn": "Sign In",
        "common.signOut": "Sign Out",
        "common.byAuthor": "By Abdullah bin Ahmed",
        "header.badge": "Designed for Saudi ambition",
        "header.heroTitle": "AI Resume Optimizer",
        "header.heroDescription": "Transform your experience into a compelling story.",
        "header.workflow.title": "Your Workflow",
        "header.workflow.step1.title": "Upload or paste your resume",
        "header.workflow.step1.desc": "Drag & drop with instant AI processing",
        "header.workflow.step2.title": "Match against Saudi job roles",
        "header.workflow.step2.desc": "Get a confidence score and missing keywords",
        "header.workflow.step3.title": "Optimize with precision",
        "header.workflow.step3.desc": "Premium suggestions for modern employers",
        "header.features.smartParsing.label": "Smart Parsing",
        "header.features.smartParsing.desc": "AI-powered extraction",
        "header.features.matchScore.label": "Match Score",
        "header.features.matchScore.desc": "Saudi market fit",
        "header.features.proOutput.label": "Pro Output",
        "header.features.proOutput.desc": "Optimized insights",
      };
      return translations[key] || key;
    },
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

const renderWithProviders = (ui) => {
  return render(<DirectionProvider>{ui}</DirectionProvider>);
};

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
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => { });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => { });

    const { container } = renderWithProviders(<Header />);

    // No bg-hero when skyline is empty
    expect(container.querySelector(".bg-hero")).toBeNull();

    // Should have glowing orbs as fallback (blur-3xl elements)
    const glowingOrbs = container.querySelectorAll(".blur-3xl");
    expect(glowingOrbs.length).toBeGreaterThan(0);

    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("renders gradient overlay even when skyline is missing", () => {
    const { container } = renderWithProviders(<Header />);

    // Should have glowing orbs with blur effect
    const glowingOrbs = container.querySelectorAll(".blur-3xl");
    expect(glowingOrbs.length).toBeGreaterThan(0);
  });

  it("provides accessible labelling for interactive controls and hides decorative icons", () => {
    const { container } = renderWithProviders(<Header />);

    // Check that decorative icons have aria-hidden
    container.querySelectorAll("svg").forEach((icon) => {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });

    // Check for Sign In button
    const signInButton = screen.getByRole("button", { name: /sign in/i });
    expect(signInButton).toBeInTheDocument();

  });
});





