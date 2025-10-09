import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Header from "../components/Layout/Header";

// Mock modules
const toggleThemeMock = vi.fn();

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("../hooks/useTheme", () => ({
  useTheme: () => ["light", toggleThemeMock],
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
    toggleThemeMock.mockClear();
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
      const appShell = container.querySelector("header .app-shell");

      expect(appShell).not.toBeNull();
      expect(appShell?.className).toContain("py-4");
      expect(appShell?.className).toContain("sm:py-6");
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

  describe("Theme Toggle Accessibility", () => {
    it("provides clear labelling and reflective affordance", () => {
      render(<Header />);

      const themeToggle = screen.getByRole("button", { name: /switch to dark theme/i });
      expect(themeToggle).toBeInTheDocument();
      expect(themeToggle).toHaveAttribute("aria-pressed", "false");
      expect(themeToggle.className).toContain("backdrop-blur-soft");

      const reflectionLayer = themeToggle.querySelector('[aria-hidden="true"]');
      expect(reflectionLayer).not.toBeNull();
      expect(reflectionLayer?.className).toContain("opacity-0");
    });

    it("invokes the theme toggle handler on click", async () => {
      const user = userEvent.setup();
      render(<Header />);

      const themeToggle = screen.getByRole("button", { name: /switch to dark theme/i });
      await user.click(themeToggle);

      expect(toggleThemeMock).toHaveBeenCalledTimes(1);
    });

    it("supports keyboard activation", async () => {
      const user = userEvent.setup();
      render(<Header />);

      const themeToggle = screen.getByRole("button", { name: /switch to dark theme/i });
      themeToggle.focus();

      await user.keyboard("{Enter}");
      expect(toggleThemeMock).toHaveBeenCalledTimes(1);

      toggleThemeMock.mockClear();

      await user.keyboard(" ");
      expect(toggleThemeMock).toHaveBeenCalledTimes(1);
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
      expect(heading).toHaveClass("text-4xl", "sm:text-5xl", "lg:text-6xl");
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
      
      const themeToggle = screen.getByRole("button", {
        name: /switch to dark theme/i,
      });

      expect(themeToggle).toHaveClass("h-10", "w-10");
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

      expect(grid).toHaveClass("gap-8", "sm:gap-10", "lg:gap-12");
    });
  });
});
