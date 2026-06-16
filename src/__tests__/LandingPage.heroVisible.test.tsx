import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import LandingPage from "../pages/LandingPage";

// NOTE: we intentionally do NOT mock ../lib/assets here — this test verifies the
// hero <picture> uses a visible opacity treatment (not the washed-out white gradient
// regression) for the bundled skyline asset.

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

describe("LandingPage — signed-out hero visibility (regression guard)", () => {
  it("resolves the hero <picture> to the bundled local skyline asset, not the SVG fallback", () => {
    const { container } = render(<LandingPage onGetStarted={vi.fn()} />);

    const heroImgs = Array.from(container.querySelectorAll("img")).filter((img) =>
      img.getAttribute("src")?.includes("kafdh-hero-desktop"),
    );

    expect(heroImgs.length).toBeGreaterThan(0);
    for (const img of heroImgs) {
      const src = img.getAttribute("src") ?? "";
      expect(src).toContain("hero/kafdh-hero-desktop-1920x1080.avif");
      expect(src.startsWith("data:image/")).toBe(false);
    }

    const mobileSource = Array.from(container.querySelectorAll("source")).find((s) =>
      s.getAttribute("srcset")?.includes("kafdh-hero-mobile"),
    );
    expect(mobileSource).toBeTruthy();
  });

  it("does not re-introduce the washed-out hero opacity classes", () => {
    const { container } = render(<LandingPage onGetStarted={vi.fn()} />);

    const heroImg = Array.from(container.querySelectorAll("img")).find((img) =>
      img.getAttribute("src")?.includes("kafdh-hero-desktop"),
    );
    expect(heroImg).toBeTruthy();

    const picture = heroImg?.closest("picture");
    expect(picture).toBeTruthy();
    const className = picture?.getAttribute("class") ?? "";

    // Guard against re-introducing the near-invisible washout opacities.
    expect(className).not.toContain("opacity-[0.28]");
    expect(className).not.toContain("opacity-[0.34]");
    expect(className).not.toContain("opacity-20");

    // Pin the new visible opacity classes for the main hero.
    expect(className).toContain("opacity-[0.65]");
    expect(className).toContain("dark:opacity-[0.5]");
  });
});
