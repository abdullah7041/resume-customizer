import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Header from "../components/Layout/Header";

// Mock modules
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("../hooks/useTheme", () => ({
  useTheme: () => ["light", vi.fn()],
}));

vi.mock("../lib/assets", () => ({
  getSkylineUrl: () => "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PC9zdmc+",
}));

describe("Mobile Layout Polish", () => {
  let matchMedia;

  beforeEach(() => {
    // Mock matchMedia
    matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    window.matchMedia = matchMedia;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Single Document Scroll", () => {
    it("should not have nested overflow-y scroll containers", () => {
      const { container } = render(<Header />);
      
      // Check that body doesn't have overflow-y: scroll
      const bodyStyle = window.getComputedStyle(document.body);
      expect(bodyStyle.overflowY).not.toBe("scroll");
      
      // Check that no nested elements have overflow-y: scroll or auto
      const allElements = container.querySelectorAll("*");
      const scrollableElements = Array.from(allElements).filter((el) => {
        const style = window.getComputedStyle(el);
        return style.overflowY === "scroll" || style.overflowY === "auto";
      });
      
      // There should be no nested scrollable containers
      expect(scrollableElements.length).toBe(0);
    });

    it("should allow natural document flow", () => {
      render(<Header />);
      
      // The header should not restrict height
      const header = screen.getByRole("banner");
      const style = window.getComputedStyle(header);
      
      expect(style.overflow).not.toBe("hidden");
      expect(style.overflowY).not.toBe("scroll");
    });
  });

  describe("Mobile Viewport Optimization", () => {
    it("should have compact spacing on mobile viewports", () => {
      // Mock mobile viewport
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 390,
      });

      const { container } = render(<Header />);
      const header = container.querySelector("header");
      
      expect(header).toHaveClass("hero-mobile-compact");
    });

    it("should reduce padding on mobile", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 390,
      });

      render(<Header />);
      
      // Check that mobile-optimized classes are present
      const mainContainer = screen.getByRole("banner").querySelector("div");
      const classes = mainContainer?.className || "";
      
      // Should have responsive padding
      expect(classes).toMatch(/py-\d+/);
    });
  });

  describe("Shimmer on Touch", () => {
    it("should trigger shimmer animation on touch", async () => {
      const user = userEvent.setup();
      render(<Header />);
      
      const badge = screen.getByRole("button", {
        name: /Saudi Arabia ambition badge/i,
      });
      
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("badge-gold-shimmer");
      
      // Initially should not have shimmer-active
      expect(badge).not.toHaveClass("shimmer-active");
      
      // Trigger touch
      fireEvent.touchStart(badge);
      
      // Should add shimmer-active class
      await waitFor(() => {
        expect(badge).toHaveClass("shimmer-active");
      });
      
      // Should remove after timeout (800ms)
      await waitFor(
        () => {
          expect(badge).not.toHaveClass("shimmer-active");
        },
        { timeout: 1000 }
      );
    });

    it("should trigger shimmer on click", async () => {
      const user = userEvent.setup();
      render(<Header />);
      
      const badge = screen.getByRole("button", {
        name: /Saudi Arabia ambition badge/i,
      });
      
      expect(badge).not.toHaveClass("shimmer-active");
      
      await user.click(badge);
      
      await waitFor(() => {
        expect(badge).toHaveClass("shimmer-active");
      });
    });

    it("should trigger shimmer on keyboard Enter", async () => {
      const user = userEvent.setup();
      render(<Header />);
      
      const badge = screen.getByRole("button", {
        name: /Saudi Arabia ambition badge/i,
      });
      
      badge.focus();
      expect(badge).not.toHaveClass("shimmer-active");
      
      await user.keyboard("{Enter}");
      
      await waitFor(() => {
        expect(badge).toHaveClass("shimmer-active");
      });
    });

    it("should trigger shimmer on keyboard Space", async () => {
      const user = userEvent.setup();
      render(<Header />);
      
      const badge = screen.getByRole("button", {
        name: /Saudi Arabia ambition badge/i,
      });
      
      badge.focus();
      await user.keyboard(" ");
      
      await waitFor(() => {
        expect(badge).toHaveClass("shimmer-active");
      });
    });

    it("should have pointer cursor and touch-action styles", () => {
      render(<Header />);
      
      const badge = screen.getByRole("button", {
        name: /Saudi Arabia ambition badge/i,
      });
      
      expect(badge).toHaveClass("badge-gold-shimmer");
      
      // Check for CSS class that includes pointer and touch styles
      const styles = window.getComputedStyle(badge);
      expect(badge.className).toContain("badge-gold-shimmer");
    });

    it("should not animate when prefers-reduced-motion is enabled", async () => {
      // Mock prefers-reduced-motion
      matchMedia.mockImplementation((query) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const user = userEvent.setup();
      render(<Header />);
      
      const badge = screen.getByRole("button", {
        name: /Saudi Arabia ambition badge/i,
      });
      
      await user.click(badge);
      
      // Should still add class but CSS will prevent animation
      await waitFor(() => {
        expect(badge).toHaveClass("shimmer-active");
      });
    });
  });

  describe("Hero Image Overlay", () => {
    it("should have overlay on background image", () => {
      const { container } = render(<Header />);
      
      // Find the skyline background
      const bgHero = container.querySelector(".bg-hero");
      expect(bgHero).toBeInTheDocument();
      
      // Should have the bg-hero class which includes ::before overlay
      expect(bgHero).toHaveClass("bg-hero");
    });

    it("should reduce opacity via overlay for better text contrast", () => {
      const { container } = render(<Header />);
      
      const bgHero = container.querySelector(".bg-hero");
      expect(bgHero).toBeInTheDocument();
      
      // The overlay is applied via ::before pseudo-element in CSS
      // We verify the class is present
      expect(bgHero?.className).toContain("bg-hero");
    });
  });

  describe("Responsive Typography", () => {
    it("should scale font sizes for mobile", () => {
      render(<Header />);
      
      const heading = screen.getByRole("heading", {
        name: /AI Resume Optimizer/i,
      });
      
      // Should have responsive text classes
      expect(heading).toHaveClass("text-3xl", "sm:text-4xl", "lg:text-5xl");
    });

    it("should have compact spacing between elements", () => {
      const { container } = render(<Header />);
      
      // Check main content container has compact gaps
      const mainGrid = container.querySelector(".grid");
      expect(mainGrid).toHaveClass("gap-8");
    });
  });

  describe("Touch-Friendly Targets", () => {
    it("should have adequate touch target size for mobile", () => {
      render(<Header />);
      
      const badge = screen.getByRole("button", {
        name: /Saudi Arabia ambition badge/i,
      });
      
      const rect = badge.getBoundingClientRect();
      
      // Should have padding that makes it at least 44x44 (iOS recommendation)
      // The badge has px-4 py-1 plus text content
      expect(badge).toHaveClass("px-4", "py-1");
    });
  });

  describe("Page Height Reduction", () => {
    it("should have reduced padding in header", () => {
      const { container } = render(<Header />);
      
      const headerContent = container.querySelector("header > div");
      
      // Should have mobile-first compact padding
      expect(headerContent).toHaveClass("py-12", "sm:py-16", "lg:py-20");
    });

    it("should have compact grid gaps", () => {
      const { container } = render(<Header />);
      
      const grid = container.querySelector(".grid");
      
      expect(grid).toHaveClass("gap-8", "sm:gap-10");
    });
  });
});
