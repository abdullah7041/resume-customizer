import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import LandingPage from "../pages/LandingPage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { returnObjects?: boolean }) => (options?.returnObjects ? [] : key),
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

vi.mock("../hooks/useTheme", () => ({
  useTheme: () => ["light", vi.fn()],
}));

vi.mock("../services/analytics", () => ({
  analytics: {
    trackLandingViewed: vi.fn(),
    trackGetStartedClicked: vi.fn(),
  },
}));

describe("LandingPage — Majlis redesign structure", () => {
  it("uses the bundled skyline only in the final CTA, not as the hero background", () => {
    const { container } = render(<LandingPage onGetStarted={vi.fn()} />);

    const skylineImgs = Array.from(container.querySelectorAll("img")).filter((img) =>
      img.getAttribute("src")?.includes("kafdh-hero-desktop"),
    );

    expect(skylineImgs).toHaveLength(1);
    expect(skylineImgs[0].closest("[data-testid='majlis-final-cta']")).toBeTruthy();
    expect(container.querySelector(".majlis-hero img")).toBeNull();
  });

  it("renders the required primary CTA copy exactly three times outside the nav", () => {
    render(<LandingPage onGetStarted={vi.fn()} />);

    expect(screen.getAllByText("See your match score - free")).toHaveLength(3);
  });
});
