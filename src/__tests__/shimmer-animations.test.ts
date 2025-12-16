import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("Shimmer Animation CSS", () => {
  let cssContent: string;

  beforeEach(() => {
    // Read the actual CSS file
    const cssPath = resolve(__dirname, "../index.css");
    cssContent = readFileSync(cssPath, "utf-8");
  });

  describe("Keyframe Definitions", () => {
    it("should define badge-shimmer-sweep keyframes", () => {
      expect(cssContent).toContain("@keyframes badge-shimmer-sweep");
      expect(cssContent).toContain("background-position: 0% center");
      expect(cssContent).toContain("background-position: 200% center");
    });

    it("should define badge-shimmer-shine keyframes", () => {
      expect(cssContent).toContain("@keyframes badge-shimmer-shine");
      expect(cssContent).toMatch(/badge-shimmer-shine[^}]+left.*-100%/);
      expect(cssContent).toMatch(/badge-shimmer-shine[^}]+left.*100%/);
      expect(cssContent).toMatch(/badge-shimmer-shine[^}]+opacity.*0/);
    });
  });

  describe("Badge Gold Shimmer Class", () => {
    it("should have cursor pointer for interactivity", () => {
      const shimmerBlock = cssContent.match(/\.badge-gold-shimmer\s*{[^}]+}/s)?.[0];
      expect(shimmerBlock).toBeTruthy();
      expect(shimmerBlock).toContain("cursor: pointer");
    });

    it("should disable tap highlight for better mobile experience", () => {
      const shimmerBlock = cssContent.match(/\.badge-gold-shimmer\s*{[^}]+}/s)?.[0];
      expect(shimmerBlock).toContain("-webkit-tap-highlight-color: transparent");
    });

    it("should have touch-action manipulation", () => {
      const shimmerBlock = cssContent.match(/\.badge-gold-shimmer\s*{[^}]+}/s)?.[0];
      expect(shimmerBlock).toContain("touch-action: manipulation");
    });

    it("should have gradient background for shimmer effect", () => {
      const shimmerBlock = cssContent.match(/\.badge-gold-shimmer\s*{[^}]+}/s)?.[0];
      expect(shimmerBlock).toContain("background-image: linear-gradient");
      expect(shimmerBlock).toContain("background-clip: text");
    });

    it("should have ::after pseudo-element for shine effect", () => {
      expect(cssContent).toContain(".badge-gold-shimmer::after");
      const afterBlock = cssContent.match(/\.badge-gold-shimmer::after\s*{[^}]+}/s)?.[0];
      expect(afterBlock).toContain("pointer-events: none");
      expect(afterBlock).toContain("opacity: 0");
    });
  });

  describe("Interactive States", () => {
    it("should apply animation on :active state", () => {
      expect(cssContent).toContain(".badge-gold-shimmer:active");
      expect(cssContent).toMatch(/\.badge-gold-shimmer:active[^}]+animation.*badge-shimmer-sweep/);
    });

    it("should apply animation on .shimmer-active class", () => {
      expect(cssContent).toContain(".badge-gold-shimmer.shimmer-active");
      expect(cssContent).toMatch(/\.badge-gold-shimmer\.shimmer-active[^}]+animation.*badge-shimmer-sweep/);
    });

    it("should animate ::after on active states", () => {
      expect(cssContent).toContain(".badge-gold-shimmer:active::after");
      expect(cssContent).toContain(".badge-gold-shimmer.shimmer-active::after");
      expect(cssContent).toMatch(/badge-gold-shimmer[^}]+::after[^}]+animation.*badge-shimmer-shine/);
    });

    it("should have hover state with filter effects", () => {
      expect(cssContent).toContain(".badge-gold-shimmer:hover");
      expect(cssContent).toMatch(/\.badge-gold-shimmer:hover[^}]+filter.*drop-shadow/);
    });

    it("should have focus-visible state for keyboard navigation", () => {
      expect(cssContent).toContain(".badge-gold-shimmer:focus-visible");
    });
  });

  describe("Mobile Touch Optimization", () => {
    it("should have specific touch device styles", () => {
      expect(cssContent).toContain("@media (hover: none) and (pointer: coarse)");
      const touchBlock = cssContent.match(
        /@media \(hover: none\) and \(pointer: coarse\)[^}]+badge-shimmer-sweep/s
      );
      expect(touchBlock).toBeTruthy();
    });
  });

  describe("Reduced Motion Support", () => {
    it("should disable shimmer animations for reduced motion preference", () => {
      expect(cssContent).toContain("@media (prefers-reduced-motion: reduce)");
      expect(cssContent).toContain(".badge-gold-shimmer,");
      expect(cssContent).toContain(".badge-gold-shimmer:active,");
      expect(cssContent).toContain(".badge-gold-shimmer.shimmer-active");
      const reducedMotionIndex = cssContent.indexOf("@media (prefers-reduced-motion: reduce)");
      const afterIndex = cssContent.indexOf(".badge-gold-shimmer", reducedMotionIndex);
      expect(afterIndex).toBeGreaterThan(reducedMotionIndex);
    });

    it("should disable shimmer-active animations for reduced motion", () => {
      expect(cssContent).toContain("@media (prefers-reduced-motion: reduce)");
      expect(cssContent).toContain(".badge-gold-shimmer.shimmer-active");
    });

    it("should disable ::after animations for reduced motion", () => {
      expect(cssContent).toContain("@media (prefers-reduced-motion: reduce)");
      expect(cssContent).toContain(".badge-gold-shimmer::after,");
      expect(cssContent).toContain(".badge-gold-shimmer:active::after,");
      expect(cssContent).toContain(".badge-gold-shimmer.shimmer-active::after");
    });
  });
});

describe("Single Document Scroll CSS", () => {
  let cssContent: string;

  beforeEach(() => {
    const cssPath = resolve(__dirname, "../index.css");
    cssContent = readFileSync(cssPath, "utf-8");
  });

  it("should set html overflow-y to auto instead of hidden", () => {
    const htmlBlock = cssContent.match(/html\s*{[^}]+}/s)?.[0];
    expect(htmlBlock).toBeTruthy();
    expect(htmlBlock).toContain("overflow-y: auto");
    expect(htmlBlock).not.toContain("overflow: hidden");
  });

  it("should set body overflow-y to auto instead of scroll", () => {
    const bodyBlock = cssContent.match(/body\s*{[^}]+}/s)?.[0];
    expect(bodyBlock).toBeTruthy();
    expect(bodyBlock).toContain("overflow-y: auto");
    expect(bodyBlock).not.toContain("overflow-y: scroll");
  });

  it("should set body height to auto with min-height", () => {
    const bodyBlock = cssContent.match(/body\s*{[^}]+}/s)?.[0];
    expect(bodyBlock).toContain("height: auto");
    expect(bodyBlock).toContain("min-height: 100%");
  });

  it("should not have overflow hidden on html", () => {
    const htmlBlock = cssContent.match(/html\s*{[^}]+}/s)?.[0];
    expect(htmlBlock).not.toContain("overflow: hidden");
  });
});

describe("Hero Image Overlay CSS", () => {
  let cssContent: string;

  beforeEach(() => {
    const cssPath = resolve(__dirname, "../index.css");
    cssContent = readFileSync(cssPath, "utf-8");
  });

  it("should have bg-hero with ::before overlay", () => {
    expect(cssContent).toContain(".bg-hero");
    expect(cssContent).toContain(".bg-hero::before");
  });

  it("should apply gradient overlay for opacity reduction", () => {
    const overlayBlock = cssContent.match(/\.bg-hero::before\s*{[^}]+}/s)?.[0];
    expect(overlayBlock).toBeTruthy();
    expect(overlayBlock).toContain("background: linear-gradient");
    expect(overlayBlock).toContain("opacity: 1");
  });

  it("should have dark mode variant for overlay", () => {
    expect(cssContent).toContain(".dark .bg-hero::before");
    const darkOverlay = cssContent.match(/\.dark \.bg-hero::before\s*{[^}]+}/s)?.[0];
    expect(darkOverlay).toContain("background: linear-gradient");
  });

  it("should position overlay absolutely", () => {
    const overlayBlock = cssContent.match(/\.bg-hero::before\s*{[^}]+}/s)?.[0];
    expect(overlayBlock).toContain("position: absolute");
    expect(overlayBlock).toContain("inset: 0");
  });

  it("should disable pointer events on overlay", () => {
    const overlayBlock = cssContent.match(/\.bg-hero::before\s*{[^}]+}/s)?.[0];
    expect(overlayBlock).toContain("pointer-events: none");
  });

  it("should set z-index for proper layering", () => {
    const overlayBlock = cssContent.match(/\.bg-hero::before\s*{[^}]+}/s)?.[0];
    expect(overlayBlock).toContain("z-index: 1");
  });
});

describe("Mobile Layout CSS", () => {
  let cssContent: string;

  beforeEach(() => {
    const cssPath = resolve(__dirname, "../index.css");
    cssContent = readFileSync(cssPath, "utf-8");
  });

  it("should have mobile-specific media query", () => {
    expect(cssContent).toContain("@media (max-width: 480px)");
  });

  it("should reduce card radius on mobile", () => {
    const mobileBlock = cssContent.match(/@media \(max-width: 480px\)[^}]+{[^}]+}/s)?.[0];
    expect(mobileBlock).toBeTruthy();
    expect(mobileBlock).toContain("--radius-card:");
  });

  it("should optimize app-shell-gutter for mobile", () => {
    const mobileBlock = cssContent.match(/@media \(max-width: 480px\)[^}]+{[^}]+}/s)?.[0];
    expect(mobileBlock).toContain("--app-shell-gutter:");
  });

  it("should have hero-mobile-compact class", () => {
    expect(cssContent).toContain("@media (max-width: 480px)");
    expect(cssContent).toContain(".hero-mobile-compact");
    expect(cssContent).toContain("min-height: 90vh");
  });
});



