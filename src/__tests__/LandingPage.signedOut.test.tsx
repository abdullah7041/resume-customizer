import { render } from "@testing-library/react";
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

describe("LandingPage — signed-out Majlis page", () => {
  it("renders without auth context and keeps final CTA skyline asset local", () => {
    const { container } = render(<LandingPage onGetStarted={vi.fn()} />);

    const finalCta = container.querySelector("[data-testid='majlis-final-cta']");
    const skyline = finalCta?.querySelector("img");

    expect(finalCta).toBeTruthy();
    expect(skyline?.getAttribute("src")).toContain("hero/kafdh-hero-desktop-1920x1080.avif");
    expect(skyline?.getAttribute("src")?.startsWith("data:image/")).toBe(false);
  });
});
