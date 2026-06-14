import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import LandingPage from "../pages/LandingPage";

// NOTE: we intentionally do NOT mock ../lib/assets here — this test verifies the
// REAL skyline resolution produces a bundled, auth-independent hero asset for a
// signed-out visitor. LandingPage takes no auth/user context, which proves the
// hero never depends on an authenticated session.

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { returnObjects?: boolean }) => (options?.returnObjects ? [] : key),
  }),
}));

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
          React.createElement(tag, props, children),
    },
  ),
  useReducedMotion: () => true,
}));

vi.mock("../services/analytics", () => ({
  analytics: {
    trackLandingViewed: vi.fn(),
    trackGetStartedClicked: vi.fn(),
  },
}));

// Heavy, irrelevant subsections — stub so the test stays focused on the hero.
vi.mock("../components/sections/PricingSection", () => ({ PricingSection: () => <div /> }));
vi.mock("../components/ui/ComparisonTable", () => ({ ComparisonTable: () => <div /> }));
vi.mock("../components/sections/FeatureHighlightSection", () => ({ FeatureHighlightSection: () => <div /> }));
vi.mock("../components/sections/landing/Vision2030Mockup", () => ({ Vision2030Mockup: () => <div /> }));
vi.mock("../components/sections/landing/ClarificationMockup", () => ({ ClarificationMockup: () => <div /> }));
vi.mock("../components/sections/landing/InterviewPrepMockup", () => ({ InterviewPrepMockup: () => <div /> }));

describe("LandingPage — signed-out hero visibility", () => {
  it("renders the bundled hero skyline image without requiring auth", () => {
    const { container } = render(<LandingPage onGetStarted={vi.fn()} />);

    const heroImgs = Array.from(container.querySelectorAll("img")).filter((img) =>
      img.getAttribute("src")?.includes("kafdh-hero-desktop"),
    );

    expect(heroImgs.length).toBeGreaterThan(0);
    for (const img of heroImgs) {
      const src = img.getAttribute("src") ?? "";
      expect(src).toContain("hero/kafdh-hero-desktop-1920x1080.avif");
      // Must be the real bundled asset, NOT the faint inline SVG fallback.
      expect(src.startsWith("data:image/")).toBe(false);
    }

    // The <picture> should also offer the bundled mobile source for small screens.
    const mobileSource = Array.from(container.querySelectorAll("source")).find((s) =>
      s.getAttribute("srcset")?.includes("kafdh-hero-mobile"),
    );
    expect(mobileSource).toBeTruthy();
  });
});
