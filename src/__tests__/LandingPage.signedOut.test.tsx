import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LandingPage from "../pages/LandingPage";

const { signInWithGoogle, signInWithLinkedIn } = vi.hoisted(() => ({
  signInWithGoogle: vi.fn(),
  signInWithLinkedIn: vi.fn(),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ signInWithGoogle, signInWithLinkedIn }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { returnObjects?: boolean }) => (options?.returnObjects ? [] : key),
    i18n: { language: "en", changeLanguage: vi.fn(), dir: () => "ltr" },
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
  it("keeps Google available when LinkedIn cannot start from the landing page", async () => {
    signInWithLinkedIn.mockResolvedValueOnce(undefined);
    render(<LandingPage onGetStarted={vi.fn()} showSignIn />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.click(dialog.getByRole("button", { name: "common.continueWithLinkedIn" }));

    expect(signInWithLinkedIn).toHaveBeenCalledWith({ intent: "signin", source: "landing_get_started" });
    expect(await dialog.findByRole("alert")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "common.continueWithGoogle" })).toBeEnabled();
  });

  it("renders without auth context and keeps final CTA skyline asset local", () => {
    const { container } = render(<LandingPage onGetStarted={vi.fn()} />);

    const finalCta = container.querySelector("[data-testid='majlis-final-cta']");
    const skyline = finalCta?.querySelector("img");

    expect(finalCta).toBeTruthy();
    expect(skyline?.getAttribute("src")).toContain("hero/kafdh-hero-desktop-1920x1080.avif");
    expect(skyline?.getAttribute("src")?.startsWith("data:image/")).toBe(false);
  });
});
